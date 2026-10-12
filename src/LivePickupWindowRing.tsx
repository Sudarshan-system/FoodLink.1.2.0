import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from './ThemeContext';

export interface LivePickupWindowRingProps {
  totalWindowMinutes?: number;
  initialRemainingMinutes?: number;
  batchName?: string;
  donorVenue?: string;
  shelterDestination?: string;
  size?: number;
}

export const LivePickupWindowRing: React.FC<LivePickupWindowRingProps> = ({
  totalWindowMinutes = 45, // 45-minute safe dispatch & pickup window
  initialRemainingMinutes = 28, // 28 minutes remaining
  batchName = 'Fresh Dal Makhani & Roti (45 kg)',
  donorVenue = 'Grand Palace Banquets',
  shelterDestination = 'Asha Sadan Shelter',
  size = 96,
}) => {
  const { isDark } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const prevAngleRef = useRef<number>(0);
  const isFirstRenderRef = useRef<boolean>(true);

  const totalSeconds = totalWindowMinutes * 60;
  // Initialize remaining countdown seconds (default 28 mins 34 secs)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    return initialRemainingMinutes * 60 + 34;
  });

  // Dynamic 1-second countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Loop seamlessly to a fresh 45-minute dispatch window
          return totalSeconds * 0.85;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [totalSeconds]);

  // Derived time units
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  // Fraction remaining (1.0 = full window, 0.0 = expired)
  const fractionRemaining = Math.max(0, Math.min(1, secondsRemaining / totalSeconds));
  const percentRemaining = Math.round(fractionRemaining * 100);

  // Status classification
  const isUrgent = fractionRemaining < 0.2; // < 20%
  const isCaution = fractionRemaining < 0.45; // < 45%

  // Colors based on urgency & theme
  const trackColor = isDark ? '#1C3125' : '#E2ECE5';
  const progressColor = isUrgent
    ? '#EF4444' // Red-500
    : isCaution
    ? '#F59E0B' // Amber-500
    : '#059669'; // Emerald-600

  const progressEndColor = isUrgent
    ? '#DC2626'
    : isCaution
    ? '#D97706'
    : '#10B981';

  // Render & Update D3 Circular Arc
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = size;
    const height = size;
    const margin = 5;
    const radius = Math.min(width, height) / 2 - margin;
    const strokeWidth = 8;

    let g = svg.select<SVGGElement>('g.ring-group');
    let defs = svg.select<SVGDefsElement>('defs');
    const gradientId = `pickup-timer-grad-${Math.round(size)}`;

    if (g.empty()) {
      // First mount: initialize persistent SVG nodes
      svg.selectAll('*').remove();
      defs = svg.append('defs');

      const gradient = defs
        .append('linearGradient')
        .attr('id', gradientId)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '100%');

      gradient.append('stop').attr('class', 'grad-stop-0').attr('offset', '0%');
      gradient.append('stop').attr('class', 'grad-stop-1').attr('offset', '100%');

      g = svg
        .append('g')
        .attr('class', 'ring-group')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

      // 1. Background circle track
      g.append('path').attr('class', 'background-track');

      // 2. Foreground dynamic progress arc
      g.append('path').attr('class', 'progress-arc');

      // 3. Glowing indicator tip dot
      g.append('circle').attr('class', 'tip-circle');
    }

    // Update gradient colors
    defs.select('.grad-stop-0').attr('stop-color', progressColor);
    defs.select('.grad-stop-1').attr('stop-color', progressEndColor);

    // Background track arc generator
    const backgroundArc = d3
      .arc<any>()
      .innerRadius(radius - strokeWidth)
      .outerRadius(radius)
      .startAngle(0)
      .endAngle(2 * Math.PI)
      .cornerRadius(strokeWidth / 2);

    g.select('.background-track')
      .attr('d', backgroundArc as any)
      .attr('fill', trackColor);

    // Foreground progress arc generator
    const targetEndAngle = 2 * Math.PI * fractionRemaining;

    const foregroundArc = d3
      .arc<any>()
      .innerRadius(radius - strokeWidth)
      .outerRadius(radius)
      .startAngle(0)
      .cornerRadius(strokeWidth / 2);

    const progressPath = g.select('.progress-arc')
      .attr('fill', `url(#${gradientId})`);

    const tipCircle = g.select('.tip-circle');

    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      // Smooth initial mount animation from 0 to targetEndAngle
      progressPath
        .datum({ endAngle: 0 })
        .transition()
        .duration(700)
        .ease(d3.easeCubicOut)
        .attrTween('d', function (d: any) {
          const interpolate = d3.interpolate(d.endAngle, targetEndAngle);
          return function (t: number) {
            d.endAngle = interpolate(t);
            return (foregroundArc as any)(d);
          };
        })
        .on('end', () => {
          prevAngleRef.current = targetEndAngle;
        });
    } else {
      // Dynamic updates: smoothly interpolate from previous angle to new angle
      const startAngle = prevAngleRef.current;
      progressPath
        .datum({ endAngle: startAngle })
        .interrupt()
        .transition()
        .duration(280)
        .ease(d3.easeLinear)
        .attrTween('d', function (d: any) {
          const interpolate = d3.interpolate(startAngle, targetEndAngle);
          return function (t: number) {
            d.endAngle = interpolate(t);
            return (foregroundArc as any)(d);
          };
        });
      prevAngleRef.current = targetEndAngle;
    }

    // Position the tip indicator dot along the arc perimeter
    if (fractionRemaining > 0.02) {
      const tipAngle = targetEndAngle - Math.PI / 2;
      const tipRadius = radius - strokeWidth / 2;
      const dotX = Math.cos(tipAngle) * tipRadius;
      const dotY = Math.sin(tipAngle) * tipRadius;

      tipCircle
        .attr('cx', dotX)
        .attr('cy', dotY)
        .attr('r', 2.5)
        .attr('fill', '#FFFFFF')
        .attr('filter', 'drop-shadow(0 0 2px rgba(0,0,0,0.5))')
        .style('display', 'block');
    } else {
      tipCircle.style('display', 'none');
    }
  }, [fractionRemaining, isDark, progressColor, progressEndColor, size, trackColor]);

  // Formatted countdown strings
  const formattedCountdown = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const totalDisplay = `${totalWindowMinutes}m`;

  return (
    <div className="pt-3 border-t border-[#D1E3D7] dark:border-[#244535]">
      {/* Container holding the circular D3 ring + timer description */}
      <div className="p-3.5 rounded-2xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7]/80 dark:border-[#244535]/80 flex flex-col sm:flex-row items-center gap-4">
        {/* Left: D3 Circular Progress Ring */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg
            ref={svgRef}
            width={size}
            height={size}
            className="overflow-visible"
            aria-label={`Time remaining in current pickup window: ${formattedCountdown}`}
            role="progressbar"
            aria-valuenow={percentRemaining}
            aria-valuemin={0}
            aria-valuemax={100}
          />
          {/* Centered live countdown typography */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
            <span className="text-[8px] uppercase tracking-wider font-extrabold text-[#4B6356] dark:text-[#B2CDC0]">
              Remaining
            </span>
            <span
              className={`text-sm font-black font-mono tabular-nums leading-tight ${
                isUrgent
                  ? 'text-red-600 dark:text-red-400'
                  : isCaution
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-[#059669] dark:text-[#34D399]'
              }`}
            >
              {formattedCountdown}
            </span>
            <span className="text-[9.5px] font-bold text-[#4B6356] dark:text-[#B2CDC0] opacity-80">
              {percentRemaining}%
            </span>
          </div>
        </div>

        {/* Right: Active Pickup Window Details */}
        <div className="flex-1 min-w-0 text-left w-full">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] truncate">
                Current Pickup Window
              </span>
            </div>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 ${
                isUrgent
                  ? 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30'
                  : isCaution
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {percentRemaining}% Time Left
            </span>
          </div>

          <p className="text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] truncate">
            {batchName}
          </p>

          <div className="mt-1 text-[11px] text-[#4B6356] dark:text-[#B2CDC0] space-y-0.5">
            <div className="flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-[13px] text-amber-500 shrink-0">
                schedule
              </span>
              <span className="font-mono tabular-nums text-[11px]">
                <strong className="text-[#0F1E17] dark:text-[#F4F8F5]">{formattedCountdown}</strong> left of {totalDisplay} window
              </span>
              <span className="opacity-60 hidden sm:inline">· Thermal Safe</span>
            </div>

            <div className="flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-[13px] text-[#059669] dark:text-[#34D399] shrink-0">
                route
              </span>
              <span className="truncate text-[11px]">{donorVenue} → {shelterDestination}</span>
            </div>
          </div>

          {/* Micro-metrics pills */}
          <div className="mt-2 pt-2 border-t border-[#D1E3D7]/50 dark:border-[#244535]/50 flex items-center justify-between text-[10px] text-[#4B6356] dark:text-[#B2CDC0]">
            <span className="font-bold text-[#059669] dark:text-[#34D399] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669] dark:bg-[#34D399]"></span>
              45 kg Batch
            </span>
            <span>90 Meals</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">Courier En Route</span>
          </div>
        </div>
      </div>
    </div>
  );
};
