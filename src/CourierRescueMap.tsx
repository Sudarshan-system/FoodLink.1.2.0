import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { FoodListing } from './DonorDashboard';
import { INDIAN_CITIES } from './cities';
import { useTheme } from './ThemeContext';
import {
  MultiStopRoutePlanner,
  OptimizedRoutePlan,
  RouteStop,
} from './MultiStopRoutePlanner';

interface ActiveMission {
  listing: FoodListing;
  status: 'heading_to_donor' | 'at_donor' | 'en_route_shelter' | 'delivered';
  transportMode: 'bike' | 'auto' | 'van';
  distanceKm: number;
  etaMinutes: number;
  tempChecked: boolean;
  hygieneApproved: boolean;
  handoffOtpInput: string;
  acceptedAt: number;
}

interface CourierRescueMapProps {
  selectedCityId: string;
  listings: FoodListing[];
  activeMission: ActiveMission | null;
  onAcceptRun: (listing: FoodListing) => void;
  vehicleType: 'bike' | 'auto' | 'van';
  onStartMultiStopMission?: (plan: OptimizedRoutePlan) => void;
  defaultViewMode?: 'split' | 'standard' | 'multi_stop';
}

interface MapLocation {
  id: string;
  lat: number;
  lng: number;
  listing: FoodListing;
  distanceKm: number;
  isUrgent: boolean;
}

// Inner component to render calculated multi-stop route polylines
function MultiStopMapRouteRenderer({
  routePlan,
}: {
  routePlan: OptimizedRoutePlan | null;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!routePlan || !routePlan.pathCoordinates || routePlan.pathCoordinates.length < 2) {
      return;
    }

    const gMaps = (window as any).google?.maps || mapsLib;
    if (gMaps && gMaps.Polyline) {
      const poly = new gMaps.Polyline({
        path: routePlan.pathCoordinates,
        geodesic: true,
        strokeColor: '#059669',
        strokeOpacity: 0.95,
        strokeWeight: 6,
        map,
      });

      polylineRef.current = poly;

      if (gMaps.LatLngBounds) {
        const bounds = new gMaps.LatLngBounds();
        routePlan.pathCoordinates.forEach((pt) => bounds.extend(pt));
        map.fitBounds(bounds, { top: 70, bottom: 70, left: 70, right: 70 });
      }
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, routePlan, mapsLib]);

  return null;
}

// Inner component to handle active mission route rendering and camera auto-fit
function MapRouteRenderer({
  activeMission,
  centerLat,
  centerLng,
}: {
  activeMission: ActiveMission | null;
  centerLat: number;
  centerLng: number;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const routesLib = useMapsLibrary('routes');
  const polylineRef = useRef<any>(null);
  const routePolylinesRef = useRef<any[]>([]);

  useEffect(() => {
    if (!map) return;

    // Clear existing polylines
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    routePolylinesRef.current.forEach((p) => p.setMap(null));
    routePolylinesRef.current = [];

    if (!activeMission) {
      // Pan back to city center
      map.panTo({ lat: centerLat, lng: centerLng });
      return;
    }

    // Coordinates for pickup and shelter destination
    const pickupLat = centerLat + 0.015;
    const pickupLng = centerLng - 0.012;
    const dropoffLat = centerLat - 0.022;
    const dropoffLng = centerLng + 0.025;
    const isEnRoute = activeMission.status === 'en_route_shelter';
    const strokeColor = isEnRoute ? '#059669' : '#D97706';

    let didRenderRoutesApi = false;

    // Attempt modern Routes API computeRoutes first
    if (routesLib && (routesLib as any).Route && (routesLib as any).Route.computeRoutes) {
      const originCoord = isEnRoute
        ? { lat: pickupLat, lng: pickupLng }
        : { lat: centerLat, lng: centerLng };
      const destCoord = isEnRoute
        ? { lat: dropoffLat, lng: dropoffLng }
        : { lat: pickupLat, lng: pickupLng };

      (routesLib as any).Route.computeRoutes({
        origin: originCoord,
        destination: destCoord,
        travelMode: activeMission.transportMode === 'bike' ? 'TWO_WHEELER' : 'DRIVING',
        fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
      })
        .then(({ routes }: { routes: any[] }) => {
          if (routes && routes.length > 0) {
            didRenderRoutesApi = true;
            // Clear fallback if any was drawn
            if (polylineRef.current) {
              polylineRef.current.setMap(null);
              polylineRef.current = null;
            }
            const primaryRoute = routes[0];
            const newPolylines = primaryRoute.createPolylines();
            newPolylines.forEach((poly: any) => {
              poly.setOptions({
                strokeColor,
                strokeWeight: 6,
                strokeOpacity: 0.9,
              });
              poly.setMap(map);
            });
            routePolylinesRef.current = newPolylines;

            if (primaryRoute.viewport) {
              map.fitBounds(primaryRoute.viewport, { top: 60, bottom: 60, left: 60, right: 60 });
            }
          }
        })
        .catch(() => {
          // Fallback to geometric polylines handled below
        });
    }

    // Geometric polyline fallback or initial instant render
    const pathCoordinates = [
      { lat: pickupLat, lng: pickupLng },
      { lat: centerLat + 0.005, lng: centerLng - 0.004 },
      { lat: centerLat - 0.008, lng: centerLng + 0.012 },
      { lat: dropoffLat, lng: dropoffLng },
    ];

    const gMaps = (window as any).google?.maps || mapsLib;
    if (gMaps && gMaps.Polyline) {
      const poly = new gMaps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor,
        strokeOpacity: 0.9,
        strokeWeight: 5,
        map,
      });

      polylineRef.current = poly;

      if (!didRenderRoutesApi && gMaps.LatLngBounds) {
        const bounds = new gMaps.LatLngBounds();
        pathCoordinates.forEach((pt) => bounds.extend(pt));
        map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
      }
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      routePolylinesRef.current.forEach((p) => p.setMap(null));
      routePolylinesRef.current = [];
    };
  }, [map, activeMission, centerLat, centerLng, mapsLib, routesLib]);

  return null;
}

export const CourierRescueMap: React.FC<CourierRescueMapProps> = ({
  selectedCityId,
  listings,
  activeMission,
  onAcceptRun,
  vehicleType,
  onStartMultiStopMission,
  defaultViewMode = 'split',
}) => {
  const { isDark } = useTheme();
  const apiKey =
    (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
    'AIzaSyCwhHMmXHsRmTDYF0LqSUEPPWvSzB2IUNU';

  const [selectedMarker, setSelectedMarker] = useState<MapLocation | null>(null);
  const [selectedRouteStop, setSelectedRouteStop] = useState<RouteStop | null>(null);
  const [mapViewMode, setMapViewMode] = useState<'standard' | 'split' | 'multi_stop'>(
    defaultViewMode
  );
  const [multiStopPlan, setMultiStopPlan] = useState<OptimizedRoutePlan | null>(null);

  // Resolve current city geographic coordinates
  const cityInfo = useMemo(() => {
    const found = INDIAN_CITIES.find((c) => c.id === selectedCityId);
    if (found && found.id !== 'all') return found;
    // Default to Mumbai
    return (
      INDIAN_CITIES.find((c) => c.id === 'mumbai') || {
        id: 'mumbai',
        name: 'Mumbai',
        lat: 19.076,
        lng: 72.8777,
        zoom: 12,
        state: 'Maharashtra',
        hubs: [],
        partnerCount: 88,
      }
    );
  }, [selectedCityId]);

  // Convert listings into distributed geographic pins around the city center
  const mappedPickups = useMemo<MapLocation[]>(() => {
    // Coordinate distribution offsets around city center for realistic urban placement
    const offsets = [
      { dLat: 0.018, dLng: -0.015 },
      { dLat: -0.014, dLng: 0.022 },
      { dLat: 0.028, dLng: 0.008 },
      { dLat: -0.025, dLng: -0.018 },
      { dLat: 0.008, dLng: 0.035 },
      { dLat: -0.035, dLng: 0.012 },
      { dLat: 0.032, dLng: -0.028 },
      { dLat: -0.019, dLng: -0.032 },
    ];

    return listings.map((listing, idx) => {
      const offset = offsets[idx % offsets.length];
      const lat = cityInfo.lat + offset.dLat;
      const lng = cityInfo.lng + offset.dLng;
      // Distance calculation (haversine approximation in km)
      const dist = Math.round((Math.sqrt(offset.dLat ** 2 + offset.dLng ** 2) * 111) * 10) / 10;
      const isUrgent = (listing.status === 'claimed') || listing.foodType?.includes('Hot') || false;

      return {
        id: listing.id,
        lat,
        lng,
        listing,
        distanceKm: Math.max(0.8, dist),
        isUrgent,
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm); // sorted by closest pending pickups
  }, [listings, cityInfo]);

  // Vehicle transport speed estimate (minutes per km)
  const getEtaMinutes = (distKm: number) => {
    const minsPerKm = vehicleType === 'bike' ? 2.5 : vehicleType === 'auto' ? 3.5 : 4.5;
    return Math.max(5, Math.round(distKm * minsPerKm + 4));
  };

  // Live GPS moving dot progress state
  const [gpsProgress, setGpsProgress] = useState(0.25);
  useEffect(() => {
    if (!activeMission) return;
    const interval = setInterval(() => {
      setGpsProgress((prev) => {
        const next = prev + 0.035;
        return next > 0.95 ? 0.1 : next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [activeMission]);

  // Compute live interpolated GPS position along mission route
  const courierGpsPos = useMemo(() => {
    if (!activeMission) return null;
    const pickupLat = cityInfo.lat + 0.015;
    const pickupLng = cityInfo.lng - 0.012;
    const dropoffLat = cityInfo.lat - 0.022;
    const dropoffLng = cityInfo.lng + 0.025;

    const isEnRoute = activeMission.status === 'en_route_shelter';
    const startLat = isEnRoute ? pickupLat : cityInfo.lat;
    const startLng = isEnRoute ? pickupLng : cityInfo.lng;
    const endLat = isEnRoute ? dropoffLat : pickupLat;
    const endLng = isEnRoute ? dropoffLng : pickupLng;

    return {
      lat: startLat + (endLat - startLat) * gpsProgress,
      lng: startLng + (endLng - startLng) * gpsProgress,
    };
  }, [activeMission, cityInfo, gpsProgress]);

  return (
    <div className="w-full space-y-4 animate-fadeIn">
      {/* Header Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#059669]/10 text-[#059669] flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[24px]">map</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-base text-[#0F1E17] dark:text-[#F4F8F5]">
                Active Rescue Dispatch Map • {cityInfo.name}
              </h3>
              <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
            </div>
            <p className="text-xs text-[#526357] dark:text-[#95A89C]">
              {mappedPickups.length} pending surplus pickups detected in your radius
            </p>
          </div>
        </div>

        {/* View Layout & Legend Controls */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7] dark:border-[#244535]">
            <button
              type="button"
              onClick={() => setMapViewMode('split')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                mapViewMode === 'split'
                  ? 'bg-[#059669] text-white shadow-xs'
                  : 'text-[#526357] dark:text-[#95A89C] hover:text-[#0F1E17] dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">view_agenda</span>
              <span>Map &amp; Closest Runs</span>
            </button>
            <button
              type="button"
              onClick={() => setMapViewMode('standard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                mapViewMode === 'standard'
                  ? 'bg-[#059669] text-white shadow-xs'
                  : 'text-[#526357] dark:text-[#95A89C] hover:text-[#0F1E17] dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">crop_free</span>
              <span>Expanded Map</span>
            </button>
            <button
              type="button"
              onClick={() => setMapViewMode('multi_stop')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                mapViewMode === 'multi_stop'
                  ? 'bg-[#059669] text-white shadow-xs'
                  : 'text-[#526357] dark:text-[#95A89C] hover:text-[#0F1E17] dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">alt_route</span>
              <span>Fastest Multi-Stop Circuit</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-amber-400 text-slate-900 ml-0.5">
                Google Maps
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Map + Closest Pickups Panel Container */}
      <div
        className={`grid gap-4 ${
          mapViewMode === 'split' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
        }`}
      >
        {/* Google Map Box */}
        <div
          className={`${
            mapViewMode === 'split' ? 'lg:col-span-8' : 'w-full'
          } rounded-2xl overflow-hidden border border-[#D1E3D7] dark:border-[#244535] shadow-xs relative min-h-[440px] h-[480px] bg-slate-100 dark:bg-slate-900`}
        >
          {apiKey ? (
            <APIProvider apiKey={apiKey} libraries={['marker', 'routes']}>
              <Map
                mapId={'DEMO_MAP_ID'}
                defaultCenter={{ lat: cityInfo.lat, lng: cityInfo.lng }}
                defaultZoom={cityInfo.zoom}
                gestureHandling={'greedy'}
                fullscreenControl={true}
                streetViewControl={false}
                mapTypeControl={false}
                className="w-full h-full"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              >
                {/* Active Route Polyline Layer (Single Mission) */}
                {mapViewMode !== 'multi_stop' && (
                  <MapRouteRenderer
                    activeMission={activeMission}
                    centerLat={cityInfo.lat}
                    centerLng={cityInfo.lng}
                  />
                )}

                {/* Multi-Stop Fastest Route Polyline Layer */}
                {mapViewMode === 'multi_stop' && (
                  <MultiStopMapRouteRenderer routePlan={multiStopPlan} />
                )}

                {/* City Center Base Station Marker */}
                {mapViewMode !== 'multi_stop' && (
                  <AdvancedMarker position={{ lat: cityInfo.lat, lng: cityInfo.lng }}>
                    <div className="w-8 h-8 rounded-full bg-[#059669] border-2 border-white shadow-md flex items-center justify-center text-white">
                      <span className="material-symbols-outlined text-[18px]">near_me</span>
                    </div>
                  </AdvancedMarker>
                )}

                {/* Multi-Stop Numbered Checkpoint Markers */}
                {mapViewMode === 'multi_stop' &&
                  multiStopPlan?.orderedStops &&
                  multiStopPlan.orderedStops.map((stop, sIdx) => {
                    const isStart = stop.type === 'origin';
                    const isEnd = stop.type === 'delivery';
                    const bgCol = isStart
                      ? 'bg-[#2563EB]'
                      : isEnd
                      ? 'bg-[#059669]'
                      : 'bg-[#D97706]';

                    return (
                      <AdvancedMarker
                        key={`multi-stop-marker-${stop.id}-${sIdx}`}
                        position={{ lat: stop.lat, lng: stop.lng }}
                        onClick={() => setSelectedRouteStop(stop)}
                      >
                        <div
                          className={`w-9 h-9 rounded-full ${bgCol} text-white border-2 border-white shadow-lg flex items-center justify-center font-mono font-black text-xs cursor-pointer transform hover:scale-115 transition-transform`}
                          title={`Stop #${sIdx + 1}: ${stop.title}`}
                        >
                          {sIdx + 1}
                        </div>
                      </AdvancedMarker>
                    );
                  })}

                {/* Markers for Pending Pickups */}
                {mapViewMode !== 'multi_stop' &&
                  mappedPickups.map((pickup) => {
                  const isCurrentActive = activeMission?.listing.id === pickup.id;
                  const eta = getEtaMinutes(pickup.distanceKm);

                  return (
                    <AdvancedMarker
                      key={pickup.id}
                      position={{ lat: pickup.lat, lng: pickup.lng }}
                      onClick={() => setSelectedMarker(pickup)}
                      title={`${pickup.listing.title} (${pickup.distanceKm} km)`}
                    >
                      <div
                        className={`group relative flex items-center justify-center transition-transform transform hover:scale-110 cursor-pointer ${
                          isCurrentActive ? 'scale-125 z-30' : 'z-10'
                        }`}
                      >
                        {/* Pin badge with quantity */}
                        <div
                          className={`px-2 py-1 rounded-full text-[11px] font-black shadow-md border-2 border-white flex items-center gap-1 ${
                            isCurrentActive
                              ? 'bg-[#D97706] text-white ring-2 ring-[#D97706]/40'
                              : pickup.isUrgent
                              ? 'bg-[#EA580C] text-white'
                              : 'bg-[#059669] text-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {isCurrentActive ? 'local_shipping' : 'restaurant'}
                          </span>
                          <span>{pickup.listing.quantity} {pickup.listing.unit || 'plates'}</span>
                        </div>

                        {/* Pulse beacon for urgent items */}
                        {pickup.isUrgent && !isCurrentActive && (
                          <span className="absolute -inset-1 rounded-full bg-[#EA580C]/30 animate-ping -z-10" />
                        )}
                      </div>
                    </AdvancedMarker>
                  );
                })}

                {/* Active Mission Destination Pin (Shelter Drop-off) */}
                {activeMission && (
                  <AdvancedMarker
                    position={{
                      lat: cityInfo.lat - 0.022,
                      lng: cityInfo.lng + 0.025,
                    }}
                  >
                    <div className="px-2.5 py-1 rounded-full bg-[#059669] text-white border-2 border-white text-xs font-bold shadow-md flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">volunteer_activism</span>
                      <span>Recipient Shelter</span>
                    </div>
                  </AdvancedMarker>
                )}

                {/* Real-time Courier Moving GPS Dot */}
                {courierGpsPos && activeMission && (
                  <AdvancedMarker position={courierGpsPos}>
                    <div className="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                      <span className="absolute -inset-3 rounded-full bg-[#059669]/40 animate-ping" />
                      <div className="relative px-2.5 py-1 rounded-full bg-[#0A130E] text-white border-2 border-[#10B981] shadow-xl flex items-center gap-1.5 text-[10px] font-black z-40 whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                        <span className="material-symbols-outlined text-[13px] text-[#10B981]">
                          {vehicleType === 'bike'
                            ? 'two_wheeler'
                            : vehicleType === 'auto'
                            ? 'electric_rickshaw'
                            : 'local_shipping'}
                        </span>
                        <span>
                          {activeMission.status === 'en_route_shelter'
                            ? 'En Route Shelter'
                            : 'En Route Donor'}{' '}
                          • {Math.round(22 + gpsProgress * 8)} km/h
                        </span>
                      </div>
                    </div>
                  </AdvancedMarker>
                )}

                {/* Selected Marker InfoWindow */}
                {selectedMarker && (
                  <InfoWindow
                    position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
                    onCloseClick={() => setSelectedMarker(null)}
                  >
                    <div className="p-1 max-w-xs space-y-2 text-slate-900">
                      <div className="flex items-start justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                          {selectedMarker.listing.foodType || 'Surplus Meal'}
                        </span>
                        <span className="text-xs font-bold text-emerald-700">
                          ~{selectedMarker.distanceKm} km away
                        </span>
                      </div>

                      <h4 className="font-bold text-sm leading-snug line-clamp-2">
                        {selectedMarker.listing.title}
                      </h4>

                      <p className="text-xs text-slate-600">
                        {selectedMarker.listing.donorOrg || selectedMarker.listing.donorName || 'Commercial Kitchen'}
                      </p>

                      <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-200">
                        <div>📦 <strong>{selectedMarker.listing.quantity} {selectedMarker.listing.unit || 'plates'}</strong> ready</div>
                        <div>⏱️ Window: <strong>{selectedMarker.listing.expiryTime || 'Today'}</strong></div>
                        <div>⚡ ETA by {vehicleType}: <strong>~{getEtaMinutes(selectedMarker.distanceKm)} mins</strong></div>
                        {(selectedMarker.listing.initialTemperature !== undefined || selectedMarker.listing.currentTemperature !== undefined) && (
                          <div className="text-emerald-700 font-bold flex items-center gap-1">
                            <span>🌡️ Initial Batch Temp:</span>
                            <strong className="font-mono">{selectedMarker.listing.initialTemperature ?? selectedMarker.listing.currentTemperature}°C</strong>
                          </div>
                        )}
                      </div>

                      <div className="pt-2">
                        {activeMission?.listing.id === selectedMarker.id ? (
                          <div className="w-full py-1.5 text-center text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg">
                            ✓ Currently Active Mission
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onAcceptRun(selectedMarker.listing);
                              setSelectedMarker(null);
                            }}
                            className="w-full py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            Accept &amp; Start Navigation
                          </button>
                        )}
                      </div>
                    </div>
                  </InfoWindow>
                )}

                {/* Multi-Stop Selected Stop InfoWindow */}
                {selectedRouteStop && (
                  <InfoWindow
                    position={{ lat: selectedRouteStop.lat, lng: selectedRouteStop.lng }}
                    onCloseClick={() => setSelectedRouteStop(null)}
                  >
                    <div className="p-1 max-w-[240px] text-slate-800 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase text-white ${
                            selectedRouteStop.type === 'origin'
                              ? 'bg-[#2563EB]'
                              : selectedRouteStop.type === 'delivery'
                              ? 'bg-[#059669]'
                              : 'bg-[#D97706]'
                          }`}
                        >
                          {selectedRouteStop.type}
                        </span>
                        <h4 className="font-bold text-xs truncate">
                          {selectedRouteStop.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        {selectedRouteStop.subtitle}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        📍 {selectedRouteStop.address}
                      </p>
                      {selectedRouteStop.quantity && (
                        <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 p-1 rounded">
                          📦 {selectedRouteStop.quantity} {selectedRouteStop.unit || 'plates'} ({selectedRouteStop.storageCondition || 'Safe holding'})
                        </div>
                      )}
                      {selectedRouteStop.contactPhone && (
                        <p className="text-[10px] text-slate-600">
                          📞 {selectedRouteStop.contactPerson || 'Contact'}: {selectedRouteStop.contactPhone}
                        </p>
                      )}
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
              <span className="material-symbols-outlined text-4xl text-[#059669] mb-2 animate-bounce">
                map
              </span>
              <p className="text-sm font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
                Connecting to Google Maps Logistics Network...
              </p>
            </div>
          )}

          {/* Floating Map Legend Overlay */}
          <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-[#112019]/90 backdrop-blur-xs px-3 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] text-[11px] space-y-1 shadow-md pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#059669]" />
              <span className="font-semibold text-[#0F1E17] dark:text-[#F4F8F5]">Available Surplus</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" />
              <span className="font-semibold text-[#0F1E17] dark:text-[#F4F8F5]">Urgent Window</span>
            </div>
            {activeMission && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                <span className="font-semibold text-[#D97706]">Active Rescue Mission</span>
              </div>
            )}
          </div>
        </div>

        {/* Closest Pending Pickups Drawer / List */}
        {mapViewMode === 'split' && (
          <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] p-4 flex flex-col shadow-xs h-[480px]">
            <div className="pb-3 border-b border-[#D1E3D7] dark:border-[#244535] flex items-center justify-between">
              <div>
                <h4 className="font-serif font-bold text-sm text-[#0F1E17] dark:text-[#F4F8F5] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-[#059669]">near_me</span>
                  <span>Closest Pending Pickups</span>
                </h4>
                <p className="text-[11px] text-[#526357] dark:text-[#95A89C]">
                  Sorted by nearest distance to your location
                </p>
              </div>
              <span className="text-xs font-bold text-[#059669] bg-[#ECFDF5] dark:bg-[#064E3B]/40 px-2 py-0.5 rounded-full">
                {mappedPickups.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#D1E3D7]/50 dark:divide-[#244535]/50 pr-1 mt-2">
              {mappedPickups.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#526357] dark:text-[#95A89C]">
                  No surplus pickup requests pending in {cityInfo.name}.
                </div>
              ) : (
                mappedPickups.map((pickup, idx) => {
                  const isCurrentActive = activeMission?.listing.id === pickup.id;
                  const eta = getEtaMinutes(pickup.distanceKm);

                  return (
                    <div
                      key={pickup.id}
                      className={`py-3 transition-colors rounded-xl px-2.5 ${
                        isCurrentActive
                          ? 'bg-[#FFFBEB] dark:bg-[#211A0C]/50 border border-[#F59E0B]/30'
                          : 'hover:bg-[#F8FAF8] dark:hover:bg-[#182C22]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-[#0F1E17] dark:text-[#F4F8F5] truncate">
                              {pickup.listing.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#526357] dark:text-[#95A89C] truncate">
                            {pickup.listing.donorOrg || pickup.listing.donorName || 'Food Partner'}
                          </p>
                        </div>

                        {/* Distance & ETA Pill */}
                        <div className="text-right shrink-0">
                          <span className="font-bold text-xs text-[#059669] dark:text-[#34D399] block">
                            {pickup.distanceKm} km
                          </span>
                          <span className="text-[10px] text-[#526357] dark:text-[#95A89C]">
                            ~{eta}m ({vehicleType})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-dashed border-[#D1E3D7]/60 dark:border-[#244535]/60">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-[#0F1E17] dark:text-[#F4F8F5]">
                            {pickup.listing.quantity} {pickup.listing.unit || 'plates'}
                          </span>
                          {(pickup.listing.initialTemperature !== undefined || pickup.listing.currentTemperature !== undefined) && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              🌡️ {pickup.listing.initialTemperature ?? pickup.listing.currentTemperature}°C
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedMarker(pickup)}
                            className="px-2 py-1 text-[11px] text-[#526357] hover:text-[#0F1E17] dark:text-[#95A89C] dark:hover:text-white cursor-pointer"
                          >
                            View Pin
                          </button>

                          {isCurrentActive ? (
                            <span className="text-[11px] font-bold text-[#D97706]">
                              In Mission
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAcceptRun(pickup.listing)}
                              className="px-3 py-1 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Dispatch
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Stop Route Optimizer Section (Active in multi_stop mode) */}
      {mapViewMode === 'multi_stop' && (
        <div className="pt-2 animate-fadeIn">
          <MultiStopRoutePlanner
            cityInfo={cityInfo}
            availableListings={listings}
            vehicleType={vehicleType}
            onStartMultiStopMission={onStartMultiStopMission}
            onPlanUpdated={setMultiStopPlan}
          />
        </div>
      )}

      {/* Quick Launch Banner for Multi-Stop Optimizer when in other view modes */}
      {mapViewMode !== 'multi_stop' && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-amber-500/10 border border-[#D1E3D7] dark:border-[#244535] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#059669] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[20px]">alt_route</span>
            </div>
            <div>
              <p className="text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] flex items-center gap-1.5">
                <span>Multi-Stop Consolidated Rescue Routing</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-[#059669]/15 text-[#059669]">
                  Google Maps
                </span>
              </p>
              <p className="text-[11px] text-[#526357] dark:text-[#95A89C]">
                Pick up from multiple donors in one consolidated loop and deliver to a verified shelter with optimized turn-by-turn navigation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMapViewMode('multi_stop')}
            className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>Open Multi-Stop Route Optimizer</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </button>
        </div>
      )}
    </div>
  );
};
