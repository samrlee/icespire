// Shared pan/zoom/tooltip behavior for the region map and the local
// sub-maps. Ordinary scrolling stays with the page. Explore enables wheel,
// pinch, drag and arrow-key navigation; modified wheel and zoom buttons also
// work outside that mode. All changes use the inline SVG's viewBox.

export interface MapViewerConfig {
  svg: SVGSVGElement;
  frame: HTMLElement;
  tooltip: HTMLElement;
  width: number;
  height: number;
  /** Maximum zoom-in factor relative to the full view (default 5). */
  maxZoom?: number;
  zoomInBtn?: HTMLElement | null;
  zoomOutBtn?: HTMLElement | null;
  resetBtn?: HTMLElement | null;
  /** Explicitly enables canvas gestures; ordinary scrolling works by default. */
  exploreBtn?: HTMLElement | null;
  /** Called with the current zoom factor (1 = full view) whenever it changes. */
  onZoom?: (scale: number) => void;
}

export interface MapViewer {
  /** True while the pointer interaction that just ended was a pan, not a click. */
  wasDrag(): boolean;
  /** Bring a map coordinate into view without changing the reader's zoom. */
  centerOn(x: number, y: number): void;
  reset(): void;
}

export function initMapViewer(config: MapViewerConfig): MapViewer {
  const { svg, frame, tooltip } = config;
  const interaction = frame.previousElementSibling;
  if (interaction instanceof HTMLElement && interaction.matches('[data-map-interaction]')) interaction.hidden = false;
  const BASE = { x: 0, y: 0, w: config.width, h: config.height };
  const MIN_W = BASE.w / (config.maxZoom ?? 5);
  let vb = { ...BASE };
  let exploring = false;

  function hideTip() {
    tooltip.hidden = true;
  }

  function applyViewBox() {
    const maxX = BASE.x + BASE.w - vb.w + 60;
    const maxY = BASE.y + BASE.h - vb.h + 60;
    vb.x = Math.min(Math.max(vb.x, BASE.x - 60), Math.max(maxX, BASE.x - 60));
    vb.y = Math.min(Math.max(vb.y, BASE.y - 60), Math.max(maxY, BASE.y - 60));
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    hideTip();
    config.onZoom?.(BASE.w / vb.w);
  }

  function clientToMap(clientX: number, clientY: number) {
    const rect = svg.getBoundingClientRect();
    return {
      x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
      y: vb.y + ((clientY - rect.top) / rect.height) * vb.h,
    };
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const focus = clientToMap(clientX, clientY);
    const w = Math.min(Math.max(vb.w / factor, MIN_W), BASE.w);
    const h = w * (BASE.h / BASE.w);
    vb = {
      x: focus.x - ((focus.x - vb.x) / vb.w) * w,
      y: focus.y - ((focus.y - vb.y) / vb.h) * h,
      w,
      h,
    };
    applyViewBox();
  }

  svg.addEventListener(
    'wheel',
    (e) => {
      if (!exploring && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016));
    },
    { passive: false }
  );

  const pointers = new Map<number, { x: number; y: number }>();
  let dragDistance = 0;

  const clearPointers = () => {
    for (const id of pointers.keys()) {
      if (svg.hasPointerCapture(id)) svg.releasePointerCapture(id);
    }
    pointers.clear();
  };
  const setExploring = (enabled: boolean) => {
    exploring = enabled;
    clearPointers();
    dragDistance = 0;
    svg.dataset.exploring = String(enabled);
    config.exploreBtn?.setAttribute('aria-pressed', String(enabled));
    if (config.exploreBtn) {
      config.exploreBtn.hidden = false;
      config.exploreBtn.textContent = enabled
        ? 'Finish exploring' : svg.id === 'graph-svg' ? 'Explore graph' : 'Explore map';
    }
    hideTip();
  };
  config.exploreBtn?.addEventListener('click', () => setExploring(!exploring));
  setExploring(false);

  svg.addEventListener('pointerdown', (e) => {
    if (pointers.size === 0) dragDistance = 0;
    if (!exploring || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });

  svg.addEventListener('pointermove', (e) => {
    if (!exploring) return;
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) {
      pointers.delete(e.pointerId);
      return;
    }
    const rect = svg.getBoundingClientRect();
    const scale = vb.w / rect.width;

    if (pointers.size === 1) {
      dragDistance += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
      if (dragDistance <= 5) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        return;
      }
      // Capture only once a real drag starts — capturing on pointerdown would
      // retarget the click event to the svg and break marker clicks.
      if (dragDistance > 5 && !svg.hasPointerCapture(e.pointerId)) {
        svg.setPointerCapture(e.pointerId);
      }
      vb.x -= (e.clientX - prev.x) * scale;
      vb.y -= (e.clientY - prev.y) * scale;
      applyViewBox();
    } else if (pointers.size === 2) {
      if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId);
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1];
      const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y);
      const newDist = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const midX = (e.clientX + other.x) / 2;
      const midY = (e.clientY + other.y) / 2;
      dragDistance += 10;
      if (prevDist > 0) zoomAt(midX, midY, newDist / prevDist);
      vb.x -= (midX - (prev.x + other.x) / 2) * scale;
      vb.y -= (midY - (prev.y + other.y) / 2) * scale;
      applyViewBox();
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });

  const releasePointer = (e: PointerEvent) => pointers.delete(e.pointerId);
  // A press can leave the canvas before capture begins. Listen outside it too.
  window.addEventListener('pointerup', releasePointer, true);
  window.addEventListener('pointercancel', releasePointer, true);
  svg.addEventListener('lostpointercapture', releasePointer);
  window.addEventListener('blur', clearPointers);

  svg.addEventListener('keydown', (e) => {
    if (!exploring || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const step = vb.w / 12;
    if (e.key === 'ArrowLeft') vb.x -= step;
    if (e.key === 'ArrowRight') vb.x += step;
    if (e.key === 'ArrowUp') vb.y -= step;
    if (e.key === 'ArrowDown') vb.y += step;
    applyViewBox();
  });

  const zoomAtCenter = (factor: number) => {
    const rect = svg.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  };
  config.zoomInBtn?.addEventListener('click', () => zoomAtCenter(1.4));
  config.zoomOutBtn?.addEventListener('click', () => zoomAtCenter(1 / 1.4));
  config.resetBtn?.addEventListener('click', () => {
    vb = { ...BASE };
    applyViewBox();
  });

  for (const el of svg.querySelectorAll<SVGGraphicsElement>('[data-tip-title]')) {
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      tooltip.querySelector('.tip-title')!.textContent = el.dataset.tipTitle ?? '';
      tooltip.querySelector('.tip-sub')!.textContent = el.dataset.tipSub ?? '';
      const elRect = el.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      tooltip.hidden = false;
      tooltip.style.left = `${elRect.left + elRect.width / 2 - frameRect.left}px`;
      tooltip.style.top = `${elRect.top - frameRect.top}px`;
    });
    el.addEventListener('pointerleave', hideTip);
  }

  config.onZoom?.(1);

  return {
    wasDrag: () => dragDistance > 5,
    centerOn: (x, y) => {
      // Keep the full-sheet overview intact at resting zoom. Once zoomed in,
      // centre the selection; applyViewBox keeps the camera within its bounds.
      const fullView = vb.w === BASE.w;
      vb.x = fullView ? BASE.x : x - vb.w / 2;
      vb.y = fullView ? BASE.y : y - vb.h / 2;
      applyViewBox();
    },
    reset: () => {
      vb = { ...BASE };
      applyViewBox();
    },
  };
}
