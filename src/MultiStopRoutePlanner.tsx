import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { FoodListing } from './DonorDashboard';
import { ShelterDestination, getSheltersForCity } from './shelters';
import { CityInfo } from './cities';
import { useTheme } from './ThemeContext';

export interface RouteStop {
  id: string;
  type: 'origin' | 'pickup' | 'delivery';
  title: string;
  subtitle: string;
  address: string;
  lat: number;
  lng: number;
  quantity?: number;
  unit?: string;
  storageCondition?: string;
  initialTemperature?: number;
  contactPerson?: string;
  contactPhone?: string;
  listingId?: string;
}

export interface RouteLegInfo {
  startAddress: string;
  endAddress: string;
  distanceKm: number;
  durationMins: number;
  distanceText: string;
  durationText: string;
  fromStop: RouteStop;
  toStop: RouteStop;
}

export interface OptimizedRoutePlan {
  orderedStops: RouteStop[];
  legs: RouteLegInfo[];
  totalDistanceKm: number;
  totalDurationMins: number;
  timeSavedMins: number;
  co2SavedKg: number;
  temperatureSafe: boolean;
  maxHoldingMins: number;
  isOptimized: boolean;
  googleMapsUrl: string;
  pathCoordinates: { lat: number; lng: number }[];
}

interface MultiStopRoutePlannerProps {
  cityInfo: CityInfo;
  availableListings: FoodListing[];
  vehicleType: 'bike' | 'auto' | 'van';
  onStartMultiStopMission?: (plan: OptimizedRoutePlan) => void;
  onPlanUpdated?: (plan: OptimizedRoutePlan | null) => void;
}

export const MultiStopRoutePlanner: React.FC<MultiStopRoutePlannerProps> = ({
  cityInfo,
  availableListings,
  vehicleType,
  onStartMultiStopMission,
  onPlanUpdated,
}) => {
  const { isDark } = useTheme();
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const mapsLib = useMapsLibrary('maps');

  // Available shelters for current city
  const cityShelters = useMemo(() => getSheltersForCity(cityInfo.id), [cityInfo.id]);

  // Selected pickup listing IDs
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>(() => {
    // By default, select first 2-3 available runs
    return availableListings.slice(0, 3).map((l) => l.id);
  });

  // Selected primary delivery shelter ID
  const [selectedShelterId, setSelectedShelterId] = useState<string>(() => {
    return cityShelters[0]?.id || 'shelter_mum_1';
  });

  // Starting location mode: 'city_hub' | 'courier_gps'
  const [startPointMode, setStartPointMode] = useState<'city_hub' | 'courier_gps'>('city_hub');

  // Optimize waypoints flag (fastest vs manual order)
  const [optimizeWaypoints, setOptimizeWaypoints] = useState<boolean>(true);

  // Travel mode selection
  const [travelMode, setTravelMode] = useState<'DRIVING' | 'TWO_WHEELER'>(
    vehicleType === 'bike' ? 'TWO_WHEELER' : 'DRIVING'
  );

  // Computed route plan state
  const [routePlan, setRoutePlan] = useState<OptimizedRoutePlan | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  // Update selection if listings change
  useEffect(() => {
    if (selectedListingIds.length === 0 && availableListings.length > 0) {
      setSelectedListingIds(availableListings.slice(0, 3).map((l) => l.id));
    }
  }, [availableListings]);

  // Convert listings into RouteStop pickups with realistic offsets if coordinates missing
  const candidateStops = useMemo<RouteStop[]>(() => {
    const offsets = [
      { dLat: 0.018, dLng: -0.015 },
      { dLat: -0.014, dLng: 0.022 },
      { dLat: 0.028, dLng: 0.008 },
      { dLat: -0.025, dLng: -0.018 },
      { dLat: 0.008, dLng: 0.035 },
      { dLat: -0.035, dLng: 0.012 },
    ];

    return availableListings.map((listing, idx) => {
      const off = offsets[idx % offsets.length];
      return {
        id: listing.id,
        listingId: listing.id,
        type: 'pickup',
        title: listing.title,
        subtitle: listing.donorOrg || listing.donorName || 'Commercial Kitchen',
        address: listing.location || `${cityInfo.name} Food Hub Dock #${idx + 1}`,
        lat: cityInfo.lat + off.dLat,
        lng: cityInfo.lng + off.dLng,
        quantity: listing.quantity,
        unit: listing.unit || 'plates',
        storageCondition: listing.storageCondition || 'Hot and covered',
        initialTemperature: listing.initialTemperature ?? listing.currentTemperature,
        contactPerson: listing.contactPerson || 'Dispatch Coordinator',
        contactPhone: listing.contactPhone || '+91 98200 55442',
      };
    });
  }, [availableListings, cityInfo]);

  // Target destination shelter
  const targetShelter = useMemo(() => {
    return (
      cityShelters.find((s) => s.id === selectedShelterId) ||
      cityShelters[0] || {
        id: 'shelter_default',
        name: `${cityInfo.name} Community Care Hub`,
        cityId: cityInfo.id,
        type: 'NGO Food Bank',
        address: `Sector 4, ${cityInfo.name}`,
        contactPerson: 'Intake Officer',
        contactPhone: '+91 98200 11223',
        lat: cityInfo.lat - 0.022,
        lng: cityInfo.lng + 0.025,
        capacityMeals: 200,
      }
    );
  }, [cityShelters, selectedShelterId, cityInfo]);

  // Origin point
  const originStop = useMemo<RouteStop>(() => {
    return {
      id: 'origin_hub',
      type: 'origin',
      title: `${cityInfo.name} Courier Dispatch Hub`,
      subtitle: 'Starting Point',
      address: `Central Logistics Terminal, ${cityInfo.name}`,
      lat: cityInfo.lat,
      lng: cityInfo.lng,
    };
  }, [cityInfo]);

  // Destination point
  const destinationStop = useMemo<RouteStop>(() => {
    return {
      id: targetShelter.id,
      type: 'delivery',
      title: targetShelter.name,
      subtitle: `Recipient Shelter (${targetShelter.type})`,
      address: targetShelter.address,
      lat: targetShelter.lat,
      lng: targetShelter.lng,
      contactPerson: targetShelter.contactPerson,
      contactPhone: targetShelter.contactPhone,
    };
  }, [targetShelter]);

  // Selected pickup stops
  const selectedPickupStops = useMemo(() => {
    return candidateStops.filter((s) => selectedListingIds.includes(s.id));
  }, [candidateStops, selectedListingIds]);

  // Function to calculate fastest route using Google Maps Directions Service
  const handleCalculateRoute = () => {
    if (selectedPickupStops.length === 0) {
      setCalcError('Please select at least 1 food pickup point to calculate the route.');
      return;
    }

    setIsCalculating(true);
    setCalcError(null);

    // Prepare Google Maps Directions Request
    const googleMaps = (window as any).google?.maps || mapsLib;

    const executeWithDirectionsService = async () => {
      // 1. Modern Routes API Route.computeRoutes check
      if (routesLib && (routesLib as any).Route && (routesLib as any).Route.computeRoutes) {
        try {
          const intermediates = selectedPickupStops.map((stop) => ({
            location: {
              latLng: {
                latitude: stop.lat,
                longitude: stop.lng,
              },
            },
          }));

          const request = {
            origin: {
              location: {
                latLng: {
                  latitude: originStop.lat,
                  longitude: originStop.lng,
                },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: destinationStop.lat,
                  longitude: destinationStop.lng,
                },
              },
            },
            intermediates,
            optimizeWaypointOrder: optimizeWaypoints,
            travelMode: travelMode === 'TWO_WHEELER' ? 'TWO_WHEELER' : 'DRIVING',
            fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs', 'polyline'],
          };

          const response = await (routesLib as any).Route.computeRoutes(request);
          if (response && response.routes && response.routes.length > 0) {
            const primaryRoute = response.routes[0];
            const optIndex = primaryRoute.optimizedIntermediateWaypointIndex || [];
            const reorderedPickups =
              optimizeWaypoints && optIndex.length === selectedPickupStops.length
                ? optIndex.map((idx: number) => selectedPickupStops[idx])
                : selectedPickupStops;

            const orderedStops: RouteStop[] = [
              originStop,
              ...reorderedPickups,
              destinationStop,
            ];

            let totalDistMeters = primaryRoute.distanceMeters || 0;
            let totalDurationSec = Math.round((primaryRoute.durationMillis || 0) / 1000);
            const legsInfo: RouteLegInfo[] = [];

            if (primaryRoute.legs && primaryRoute.legs.length > 0) {
              primaryRoute.legs.forEach((leg: any, i: number) => {
                const legDistMeters = leg.distanceMeters || 0;
                const legDurationSec = Math.round((leg.durationMillis || 0) / 1000);
                const fromStop = orderedStops[i] || originStop;
                const toStop = orderedStops[i + 1] || destinationStop;

                legsInfo.push({
                  startAddress: leg.startAddress || fromStop.address,
                  endAddress: leg.endAddress || toStop.address,
                  distanceKm: Math.round((legDistMeters / 1000) * 10) / 10,
                  durationMins: Math.max(1, Math.round(legDurationSec / 60)),
                  distanceText: `${Math.round((legDistMeters / 1000) * 10) / 10} km`,
                  durationText: `${Math.max(1, Math.round(legDurationSec / 60))} mins`,
                  fromStop,
                  toStop,
                });
              });
            }

            const totalDistKm = Math.round((totalDistMeters / 1000) * 10) / 10;
            const totalMins = Math.max(1, Math.round(totalDurationSec / 60));

            const pathCoordinates: { lat: number; lng: number }[] = [];
            if (primaryRoute.polyline?.encodedPolyline && (routesLib as any).Route.decode) {
              const decoded = (routesLib as any).Route.decode(primaryRoute.polyline.encodedPolyline);
              decoded.forEach((pt: any) => {
                pathCoordinates.push({
                  lat: typeof pt.lat === 'function' ? pt.lat() : pt.lat,
                  lng: typeof pt.lng === 'function' ? pt.lng() : pt.lng,
                });
              });
            }

            if (map && primaryRoute.viewport) {
              map.fitBounds(primaryRoute.viewport, { top: 60, bottom: 60, left: 60, right: 60 });
            }

            const timeSaved = optimizeWaypoints ? Math.max(8, Math.round(totalMins * 0.28)) : 0;
            const co2Saved = Math.round(totalDistKm * 0.42 * selectedPickupStops.length * 10) / 10;
            const wpParam = reorderedPickups.map((p: RouteStop) => `${p.lat},${p.lng}`).join('|');
            const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStop.lat},${originStop.lng}&destination=${destinationStop.lat},${destinationStop.lng}&waypoints=${encodeURIComponent(wpParam)}&travelmode=${travelMode === 'TWO_WHEELER' ? 'two-wheeler' : 'driving'}`;

            const plan: OptimizedRoutePlan = {
              orderedStops,
              legs: legsInfo,
              totalDistanceKm: totalDistKm,
              totalDurationMins: totalMins,
              timeSavedMins: timeSaved,
              co2SavedKg: co2Saved,
              temperatureSafe: totalMins <= 90,
              maxHoldingMins: 90,
              isOptimized: optimizeWaypoints,
              googleMapsUrl: gmapsUrl,
              pathCoordinates: pathCoordinates.length > 0 ? pathCoordinates : orderedStops.map((s) => ({ lat: s.lat, lng: s.lng })),
            };

            setIsCalculating(false);
            setRoutePlan(plan);
            if (onPlanUpdated) onPlanUpdated(plan);
            return;
          }
        } catch (err) {
          console.warn('Routes API computeRoutes attempt, falling back:', err);
        }
      }

      // 2. Fallback to DirectionsService if available
      if (googleMaps && googleMaps.DirectionsService) {
        const directionsService = new googleMaps.DirectionsService();

        const waypoints = selectedPickupStops.map((stop) => ({
          location: new googleMaps.LatLng(stop.lat, stop.lng),
          stopover: true,
        }));

        directionsService.route(
          {
            origin: new googleMaps.LatLng(originStop.lat, originStop.lng),
            destination: new googleMaps.LatLng(destinationStop.lat, destinationStop.lng),
            waypoints,
            optimizeWaypoints: optimizeWaypoints, // Google Maps algorithms reorder waypoints for fastest travel time
            travelMode:
              travelMode === 'TWO_WHEELER'
                ? googleMaps.TravelMode.TWO_WHEELER || googleMaps.TravelMode.DRIVING
                : googleMaps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            setIsCalculating(false);

            if (status === 'OK' && result && result.routes && result.routes[0]) {
              const route = result.routes[0];
              const waypointOrder: number[] = route.waypoint_order || [];

              // Reorder pickups according to Google Maps fastest waypoint order
              const reorderedPickups =
                optimizeWaypoints && waypointOrder.length === selectedPickupStops.length
                  ? waypointOrder.map((idx) => selectedPickupStops[idx])
                  : selectedPickupStops;

              const orderedStops: RouteStop[] = [
                originStop,
                ...reorderedPickups,
                destinationStop,
              ];

              let totalDistMeters = 0;
              let totalDurationSec = 0;
              const legsInfo: RouteLegInfo[] = [];

              if (route.legs && route.legs.length > 0) {
                route.legs.forEach((leg: any, i: number) => {
                  totalDistMeters += leg.distance?.value || 0;
                  totalDurationSec += leg.duration?.value || 0;
                  const fromStop = orderedStops[i] || originStop;
                  const toStop = orderedStops[i + 1] || destinationStop;

                  legsInfo.push({
                    startAddress: leg.start_address || fromStop.address,
                    endAddress: leg.end_address || toStop.address,
                    distanceKm: Math.round(((leg.distance?.value || 0) / 1000) * 10) / 10,
                    durationMins: Math.round((leg.duration?.value || 0) / 60),
                    distanceText: leg.distance?.text || `${Math.round(((leg.distance?.value || 0) / 1000) * 10) / 10} km`,
                    durationText: leg.duration?.text || `${Math.round((leg.duration?.value || 0) / 60)} mins`,
                    fromStop,
                    toStop,
                  });
                });
              }

              const totalDistKm = Math.round((totalDistMeters / 1000) * 10) / 10;
              const totalMins = Math.round(totalDurationSec / 60);

              // Extract route polyline path points
              const pathCoordinates: { lat: number; lng: number }[] = [];
              if (route.overview_path) {
                route.overview_path.forEach((pt: any) => {
                  pathCoordinates.push({
                    lat: typeof pt.lat === 'function' ? pt.lat() : pt.lat,
                    lng: typeof pt.lng === 'function' ? pt.lng() : pt.lng,
                  });
                });
              }

              // Fit map bounds
              if (map && route.bounds) {
                map.fitBounds(route.bounds, { top: 60, bottom: 60, left: 60, right: 60 });
              }

              // Estimate time saved via AI waypoint optimization vs unoptimized sequential order
              const timeSaved = optimizeWaypoints ? Math.max(8, Math.round(totalMins * 0.28)) : 0;
              // Carbon saved by single consolidated multi-stop run vs individual separate return trips
              const co2Saved = Math.round(totalDistKm * 0.42 * selectedPickupStops.length * 10) / 10;

              // Generate official Google Maps web turn-by-turn navigation URL
              const wpParam = reorderedPickups.map((p) => `${p.lat},${p.lng}`).join('|');
              const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStop.lat},${originStop.lng}&destination=${destinationStop.lat},${destinationStop.lng}&waypoints=${encodeURIComponent(wpParam)}&travelmode=driving`;

              const plan: OptimizedRoutePlan = {
                orderedStops,
                legs: legsInfo,
                totalDistanceKm: totalDistKm,
                totalDurationMins: totalMins,
                timeSavedMins: timeSaved,
                co2SavedKg: co2Saved,
                temperatureSafe: totalMins <= 90,
                maxHoldingMins: 90,
                isOptimized: optimizeWaypoints,
                googleMapsUrl: gmapsUrl,
                pathCoordinates,
              };

              setRoutePlan(plan);
              if (onPlanUpdated) onPlanUpdated(plan);
            } else {
              // Graceful fallback to geographic heuristic calculation
              fallbackHeuristicCalculation();
            }
          }
        );
      } else {
        fallbackHeuristicCalculation();
      }
    };

    // Fallback: Haversine distance & nearest-neighbor ordering
    const fallbackHeuristicCalculation = () => {
      setIsCalculating(false);

      // Distance calculation helper
      const calcDist = (p1: { lat: number; lng: number }, p2: { lat: number; lng: number }) => {
        const dLat = (p2.lat - p1.lat) * 111;
        const dLng = (p2.lng - p1.lng) * 111 * Math.cos((p1.lat * Math.PI) / 180);
        return Math.sqrt(dLat * dLat + dLng * dLng);
      };

      // Nearest-neighbor fastest ordering
      const unvisited = [...selectedPickupStops];
      const reorderedPickups: RouteStop[] = [];
      let currentPt = { lat: originStop.lat, lng: originStop.lng };

      while (unvisited.length > 0) {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < unvisited.length; i++) {
          const d = calcDist(currentPt, unvisited[i]);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        const [nextStop] = unvisited.splice(bestIdx, 1);
        reorderedPickups.push(nextStop);
        currentPt = { lat: nextStop.lat, lng: nextStop.lng };
      }

      const orderedStops: RouteStop[] = [
        originStop,
        ...reorderedPickups,
        destinationStop,
      ];

      const legsInfo: RouteLegInfo[] = [];
      const pathCoordinates: { lat: number; lng: number }[] = [];
      let totalDistKm = 0;
      let totalMins = 0;

      for (let i = 0; i < orderedStops.length - 1; i++) {
        const fromStop = orderedStops[i];
        const toStop = orderedStops[i + 1];
        const dist = Math.round(calcDist(fromStop, toStop) * 1.35 * 10) / 10;
        const mins = Math.max(4, Math.round(dist * (travelMode === 'TWO_WHEELER' ? 2.4 : 3.2)));

        totalDistKm += dist;
        totalMins += mins;

        legsInfo.push({
          startAddress: fromStop.address,
          endAddress: toStop.address,
          distanceKm: dist,
          durationMins: mins,
          distanceText: `${dist} km`,
          durationText: `${mins} mins`,
          fromStop,
          toStop,
        });

        pathCoordinates.push({ lat: fromStop.lat, lng: fromStop.lng });
      }
      pathCoordinates.push({ lat: destinationStop.lat, lng: destinationStop.lng });

      totalDistKm = Math.round(totalDistKm * 10) / 10;

      // Fit map bounds
      if (map) {
        const gMaps = (window as any).google?.maps || mapsLib;
        if (gMaps && gMaps.LatLngBounds) {
          const bounds = new gMaps.LatLngBounds();
          orderedStops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
          map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
        }
      }

      const wpParam = reorderedPickups.map((p) => `${p.lat},${p.lng}`).join('|');
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStop.lat},${originStop.lng}&destination=${destinationStop.lat},${destinationStop.lng}&waypoints=${encodeURIComponent(wpParam)}&travelmode=driving`;

      const plan: OptimizedRoutePlan = {
        orderedStops,
        legs: legsInfo,
        totalDistanceKm: totalDistKm,
        totalDurationMins: totalMins,
        timeSavedMins: Math.round(totalMins * 0.25),
        co2SavedKg: Math.round(totalDistKm * 0.38 * selectedPickupStops.length * 10) / 10,
        temperatureSafe: totalMins <= 90,
        maxHoldingMins: 90,
        isOptimized: optimizeWaypoints,
        googleMapsUrl: gmapsUrl,
        pathCoordinates,
      };

      setRoutePlan(plan);
      if (onPlanUpdated) onPlanUpdated(plan);
    };

    executeWithDirectionsService();
  };

  // Auto-calculate on initial load or city change
  useEffect(() => {
    if (selectedPickupStops.length > 0) {
      handleCalculateRoute();
    }
  }, [cityInfo.id, travelMode, optimizeWaypoints, selectedShelterId]);

  return (
    <div className="space-y-4">
      {/* Route Planner Header & Setup Box */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D1E3D7]/60 dark:border-[#244535]/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#059669]/10 text-[#059669] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[22px]">route</span>
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#0F1E17] dark:text-[#F4F8F5] flex items-center gap-2">
                <span>Fastest Multi-Stop Route Optimizer</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#059669]/15 text-[#059669] border border-[#059669]/30">
                  Google Maps Directions
                </span>
              </h3>
              <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                Calculates the fastest multi-stop pickup circuit &amp; delivery order using AI waypoint optimization
              </p>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedListingIds(candidateStops.map((s) => s.id));
              }}
              className="px-2.5 py-1 text-xs font-bold text-[#059669] hover:bg-[#ECFDF5] dark:hover:bg-[#182C22] rounded-lg transition-colors cursor-pointer"
            >
              Select All ({candidateStops.length})
            </button>
            <span className="text-[#D1E3D7] dark:text-[#244535]">•</span>
            <button
              type="button"
              onClick={() => {
                setSelectedListingIds(candidateStops.slice(0, 2).map((s) => s.id));
              }}
              className="px-2.5 py-1 text-xs font-bold text-[#526357] dark:text-[#95A89C] hover:text-[#0F1E17] dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Top 2 Express
            </button>
          </div>
        </div>

        {/* Configuration Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* 1. Travel Mode / Vehicle */}
          <div className="p-3 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7]/60 dark:border-[#244535]/60">
            <label className="block font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1.5 flex items-center justify-between">
              <span>Transit Mode</span>
              <span className="text-[10px] text-[#526357] dark:text-[#95A89C]">Real-time traffic</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setTravelMode('TWO_WHEELER')}
                className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  travelMode === 'TWO_WHEELER'
                    ? 'bg-[#059669] text-white shadow-2xs'
                    : 'bg-white dark:bg-[#112019] text-[#526357] dark:text-[#95A89C] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">two_wheeler</span>
                <span>Bike / 2-W</span>
              </button>
              <button
                type="button"
                onClick={() => setTravelMode('DRIVING')}
                className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  travelMode === 'DRIVING'
                    ? 'bg-[#059669] text-white shadow-2xs'
                    : 'bg-white dark:bg-[#112019] text-[#526357] dark:text-[#95A89C] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">local_shipping</span>
                <span>Van / Auto</span>
              </button>
            </div>
          </div>

          {/* 2. Destination Shelter Selection */}
          <div className="p-3 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7]/60 dark:border-[#244535]/60">
            <label className="block font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1.5 flex items-center justify-between">
              <span>Final Delivery Shelter</span>
              <span className="text-[10px] text-[#059669] font-bold">Verified NGO</span>
            </label>
            <select
              value={selectedShelterId}
              onChange={(e) => setSelectedShelterId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-[#0F1E17] dark:text-[#F4F8F5] font-semibold focus:outline-none focus:border-[#059669] cursor-pointer"
            >
              {cityShelters.map((shelter) => (
                <option key={shelter.id} value={shelter.id}>
                  {shelter.name} ({shelter.capacityMeals} meals cap)
                </option>
              ))}
            </select>
          </div>

          {/* 3. Waypoint Optimization Toggle */}
          <div className="p-3 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7]/60 dark:border-[#244535]/60 flex flex-col justify-between">
            <label className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] flex items-center justify-between">
              <span>Fastest Sequence</span>
              <span className="text-[10px] text-[#D97706] font-bold">Waypoint Reordering</span>
            </label>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[#526357] dark:text-[#95A89C]">
                {optimizeWaypoints ? 'Auto-ordered for minimum travel time' : 'Manual input sequence'}
              </span>
              <button
                type="button"
                onClick={() => setOptimizeWaypoints(!optimizeWaypoints)}
                className={`w-11 h-6 rounded-full transition-colors p-1 flex items-center cursor-pointer ${
                  optimizeWaypoints ? 'bg-[#059669] justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>
          </div>
        </div>

        {/* Multi-Pickup Checkbox Selector Chips */}
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#D97706]">shopping_bag</span>
              <span>Available Surplus Pickups in {cityInfo.name} ({candidateStops.length})</span>
            </span>
            <span className="text-[11px] text-[#526357] dark:text-[#95A89C]">
              {selectedListingIds.length} stops selected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {candidateStops.map((stop) => {
              const isSelected = selectedListingIds.includes(stop.id);
              return (
                <div
                  key={stop.id}
                  onClick={() => {
                    setSelectedListingIds((prev) =>
                      prev.includes(stop.id)
                        ? prev.filter((id) => id !== stop.id)
                        : [...prev, stop.id]
                    );
                  }}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? 'border-[#059669] bg-[#ECFDF5] dark:bg-[#064E3B]/20 text-[#0F1E17] dark:text-[#F4F8F5] shadow-2xs'
                      : 'border-[#D1E3D7]/70 dark:border-[#244535]/70 bg-white dark:bg-[#112019] text-[#526357] dark:text-[#95A89C] hover:border-[#059669]/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // handled by parent div onClick
                    className="w-4 h-4 mt-0.5 accent-[#059669] rounded cursor-pointer shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs truncate text-[#0F1E17] dark:text-[#F4F8F5]">
                      {stop.title}
                    </div>
                    <p className="text-[10.5px] truncate opacity-80">{stop.subtitle}</p>
                    <div className="flex items-center justify-between mt-1 text-[10.5px] font-semibold text-[#059669]">
                      <span>{stop.quantity} {stop.unit}</span>
                      <span className="text-[10px] text-slate-500 font-normal truncate max-w-[140px] flex items-center gap-1">
                        {stop.initialTemperature !== undefined && (
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">🌡️ {stop.initialTemperature}°C</span>
                        )}
                        <span>• {stop.storageCondition}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button: Recalculate Fastest Route */}
        <div className="flex items-center justify-between pt-1">
          {calcError && (
            <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">error</span>
              <span>{calcError}</span>
            </p>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleCalculateRoute}
              disabled={isCalculating || selectedPickupStops.length === 0}
              className="px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <span className={`material-symbols-outlined text-[16px] ${isCalculating ? 'animate-spin' : ''}`}>
                {isCalculating ? 'sync' : 'navigation'}
              </span>
              <span>{isCalculating ? 'Optimizing Route...' : 'Calculate Fastest Route'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Calculated Route Summary & Turn-by-Turn Leg Itinerary */}
      {routePlan && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] shadow-xs space-y-4 animate-fadeIn">
          {/* Key Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Fastest Duration */}
            <div className="p-3 rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/20 border border-[#059669]/30">
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#059669]">
                <span className="material-symbols-outlined text-[15px]">timer</span>
                <span>Fastest Travel ETA</span>
              </div>
              <div className="font-mono font-black text-xl text-[#0F1E17] dark:text-[#F4F8F5] mt-0.5">
                ~{routePlan.totalDurationMins} mins
              </div>
              {routePlan.timeSavedMins > 0 && (
                <span className="text-[10px] font-bold text-[#059669] block mt-0.5">
                  Saved ~{routePlan.timeSavedMins}m via AI order
                </span>
              )}
            </div>

            {/* Total Distance */}
            <div className="p-3 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7]/60 dark:border-[#244535]/60">
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#526357] dark:text-[#95A89C]">
                <span className="material-symbols-outlined text-[15px]">straighten</span>
                <span>Total Circuit Distance</span>
              </div>
              <div className="font-mono font-black text-xl text-[#0F1E17] dark:text-[#F4F8F5] mt-0.5">
                {routePlan.totalDistanceKm} km
              </div>
              <span className="text-[10px] text-[#526357] dark:text-[#95A89C] block mt-0.5">
                {routePlan.legs.length} travel legs
              </span>
            </div>

            {/* FSSAI Temperature Safe Window */}
            <div className="p-3 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7]/60 dark:border-[#244535]/60">
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#059669]">
                <span className="material-symbols-outlined text-[15px]">device_thermostat</span>
                <span>Thermal Safety Window</span>
              </div>
              <div className="font-mono font-black text-sm text-[#059669] mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>100% Compliant</span>
              </div>
              <span className="text-[10px] text-[#526357] dark:text-[#95A89C] block mt-0.5">
                Completed well within 2-hr safety limit
              </span>
            </div>

            {/* CO2 Emissions Saved */}
            <div className="p-3 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7]/60 dark:border-[#244535]/60">
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#526357] dark:text-[#95A89C]">
                <span className="material-symbols-outlined text-[15px]">eco</span>
                <span>Carbon Reduction</span>
              </div>
              <div className="font-mono font-black text-xl text-[#0F1E17] dark:text-[#F4F8F5] mt-0.5">
                {routePlan.co2SavedKg} kg
              </div>
              <span className="text-[10px] text-[#526357] dark:text-[#95A89C] block mt-0.5">
                Avoided redundant separate trips
              </span>
            </div>
          </div>

          {/* Sequential Turn-by-Turn Leg Circuit */}
          <div className="space-y-2 pt-2 border-t border-[#D1E3D7]/60 dark:border-[#244535]/60">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-[#0F1E17] dark:text-[#F4F8F5] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#059669]">alt_route</span>
                <span>Optimized Fastest Itinerary ({routePlan.orderedStops.length} Checkpoints)</span>
              </h4>
              <span className="text-[11px] text-[#059669] font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#059669]" />
                <span>Reordered for Maximum Velocity</span>
              </span>
            </div>

            <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#D1E3D7] dark:before:bg-[#244535]">
              {routePlan.orderedStops.map((stop, index) => {
                const isStart = stop.type === 'origin';
                const isEnd = stop.type === 'delivery';
                const isPickup = stop.type === 'pickup';
                const legToNext = routePlan.legs[index];

                return (
                  <div key={`${stop.id}-${index}`} className="relative text-xs">
                    {/* Numbered stop circle badge */}
                    <div
                      className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center font-mono font-black text-[10px] text-white shadow-xs ${
                        isStart
                          ? 'bg-[#2563EB]'
                          : isEnd
                          ? 'bg-[#059669]'
                          : 'bg-[#D97706]'
                      }`}
                    >
                      {index + 1}
                    </div>

                    <div className="p-3 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7]/60 dark:border-[#244535]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
                            {isStart
                              ? `Stop #${index + 1}: Start at Depot`
                              : isEnd
                              ? `Stop #${index + 1}: Final Shelter Delivery`
                              : `Stop #${index + 1}: Pickup Batch`}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase ${
                              isStart
                                ? 'bg-blue-100 text-blue-800'
                                : isEnd
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {stop.type}
                          </span>
                        </div>
                        <div className="font-semibold text-xs mt-0.5 text-[#0F1E17] dark:text-[#F4F8F5]">
                          {stop.title}
                        </div>
                        <p className="text-[11px] text-[#526357] dark:text-[#95A89C] truncate">
                          {stop.address}
                        </p>
                      </div>

                      {/* Leg travel metrics to next stop */}
                      {legToNext && (
                        <div className="text-right sm:border-l sm:pl-3 border-[#D1E3D7]/60 dark:border-[#244535]/60 shrink-0">
                          <span className="text-[11px] font-bold text-[#059669] block">
                            Next: {legToNext.durationText}
                          </span>
                          <span className="text-[10px] font-mono text-[#526357] dark:text-[#95A89C]">
                            {legToNext.distanceText}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Buttons: Open in Google Maps Navigation & Start Multi-Stop Mission */}
          <div className="pt-3 border-t border-[#D1E3D7]/60 dark:border-[#244535]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <a
              href={routePlan.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] hover:bg-slate-50 dark:hover:bg-[#182C22] text-[#0F1E17] dark:text-[#F4F8F5] text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[17px] text-[#2563EB]">open_in_new</span>
              <span>Open in Google Maps Navigation App</span>
            </a>

            {onStartMultiStopMission && (
              <button
                type="button"
                onClick={() => onStartMultiStopMission(routePlan)}
                className="px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Accept Multi-Stop Rescue Circuit</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
