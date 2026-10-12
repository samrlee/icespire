// Shared pan/zoom/tooltip behavior for the region map and the local
// sub-maps. Ordinary scrolling stays with the page. Explore enables wheel,
// pinch, drag and arrow-key navigation, in a dedicated mobile dialog for maps;
// modified wheel and zoom buttons also work outside that mode. All changes
// use the original SVG's viewBox without stretching the drawing.

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
  /** On narrow screens, keep gestures inside a dedicated modal viewer. */
  explorer?: HTMLDialogElement | null;
  /** Called with the current zoom factor (1 = full view) whenever it changes. */
  onZoom?: (scale: number) => void;
}

export interface MapViewer {
  /** True while the pointer interaction that just ended was a pan, not a click. */
  wasDrag(): boolean;
  reset(): void;
  finishExploring(returnFocus?: boolean): void;
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
    // SVG meet preserves the original drawing proportions. Account for the
    // letterboxing in a landscape phone or a viewport-sized explorer.
    const matrix = svg.getScreenCTM();
    return matrix
      ? new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
      : { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 };
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
  const explorer = config.explorer;
  const narrowViewport = window.matchMedia('(max-width: 900px)');
  let placeholder: HTMLElement | null = null;
  let pagePosition = { x: 0, y: 0 };
  const pageTopBefore = document.documentElement.style.getPropertyValue('--map-page-top');
  const descriptionBefore = svg.getAttribute('aria-describedby');
  const syncExploreControl = () => {
    if (!explorer || !config.exploreBtn) return;
    config.exploreBtn.setAttribute('aria-controls', narrowViewport.matches ? explorer.id : svg.id);
    if (narrowViewport.matches) config.exploreBtn.setAttribute('aria-haspopup', 'dialog');
    else config.exploreBtn.removeAttribute('aria-haspopup');
  };
  syncExploreControl();

  function finishExploring(returnFocus = true) {
    setExploring(false);
    if (!placeholder) return;
    if (explorer?.open) explorer.close();
    placeholder.replaceWith(frame);
    placeholder = null;
    document.documentElement.classList.remove('map-explorer-open');
    if (pageTopBefore) document.documentElement.style.setProperty('--map-page-top', pageTopBefore);
    else document.documentElement.style.removeProperty('--map-page-top');
    if (descriptionBefore) svg.setAttribute('aria-describedby', descriptionBefore);
    else svg.removeAttribute('aria-describedby');
    window.scrollTo({ left: pagePosition.x, top: pagePosition.y, behavior: 'instant' });
    applyViewBox();
    if (returnFocus) config.exploreBtn?.focus({ preventScroll: true });
  }

  config.exploreBtn?.addEventListener('click', () => {
    if (!explorer || !narrowViewport.matches) {
      setExploring(!exploring);
      return;
    }
    pagePosition = { x: window.scrollX, y: window.scrollY };
    placeholder = document.createElement('div');
    placeholder.style.height = `${frame.getBoundingClientRect().height}px`;
    placeholder.setAttribute('aria-hidden', 'true');
    frame.before(placeholder);
    explorer.querySelector('[data-map-explorer-canvas]')!.appendChild(frame);
    document.documentElement.style.setProperty('--map-page-top', `${-pagePosition.y}px`);
    document.documentElement.classList.add('map-explorer-open');
    svg.setAttribute('aria-describedby', 'map-explorer-hint');
    explorer.showModal();
    setExploring(true);
    applyViewBox();
    svg.focus({ preventScroll: true });
  });
  explorer?.querySelector('[data-map-explorer-close]')?.addEventListener('click', () => finishExploring());
  explorer?.addEventListener('cancel', (e) => {
    e.preventDefault();
    finishExploring();
  });
  // Restore the frame even if another caller uses the native close() API.
  explorer?.addEventListener('close', () => {
    if (placeholder && !explorer.open) finishExploring();
  });
  if (explorer) narrowViewport.addEventListener('change', () => {
    finishExploring();
    syncExploreControl();
  });
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
    const previous = clientToMap(prev.x, prev.y);
    const current = clientToMap(e.clientX, e.clientY);

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
      vb.x -= current.x - previous.x;
      vb.y -= current.y - previous.y;
      applyViewBox();
    } else if (pointers.size === 2) {
      if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId);
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1];
      const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y);
      const newDist = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const midX = (e.clientX + other.x) / 2;
      const midY = (e.clientY + other.y) / 2;
      const oldMidX = (prev.x + other.x) / 2;
      const oldMidY = (prev.y + other.y) / 2;
      dragDistance += 10;
      if (prevDist > 0) zoomAt(oldMidX, oldMidY, newDist / prevDist);
      // Use the new scale for midpoint motion after the pinch zoom.
      const oldMid = clientToMap(oldMidX, oldMidY);
      const newMid = clientToMap(midX, midY);
      vb.x -= newMid.x - oldMid.x;
      vb.y -= newMid.y - oldMid.y;
      applyViewBox();
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });

  const releasePointer = (e: PointerEvent) => pointers.delete(e.pointerId);
  // A press can leave the canvas before capture begins. Listen outside it too.
  window.addEventListener('pointerup', releasePointer, true);
  window.addEventListener('pointercancel', releasePointer, true);
  svg.addEventListener('lostpointercapture', (e) => {
    // Touch starts with implicit capture on the hit child. Moving capture to
    // the SVG bubbles that child's loss here, but the gesture is still active.
    if (e.target === svg && !svg.hasPointerCapture(e.pointerId)) releasePointer(e);
  });
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
    finishExploring,
    reset: () => {
      vb = { ...BASE };
      applyViewBox();
    },
  };
}
