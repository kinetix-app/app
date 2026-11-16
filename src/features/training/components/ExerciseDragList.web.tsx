import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { FlatList, View, type CellRendererProps } from 'react-native';
import type { DraggableFlatListProps } from 'react-native-draggable-flatlist';
import { usePalette } from '@/theme/tokens';

const ActiveCell = createContext<number | null>(null);
type DragState = {
  rows: Map<number, HTMLFieldSetElement>;
  source: { current: number | null };
  target: { current: number | null };
  startY: { current: number };
  originBox: { current: { top: number; bottom: number } };
  setOffset: (offset: number) => void;
  setOver: (index: number | null) => void;
};

function updateDrag(
  event: React.PointerEvent<HTMLFieldSetElement>,
  index: number,
  state: DragState,
) {
  if (state.source.current !== index) return;
  setDragTarget(event, index, state);
  scrollDraggedRow(event);
}

function setDragTarget(
  event: React.PointerEvent<HTMLFieldSetElement>,
  index: number,
  state: DragState,
) {
  state.setOffset(event.clientY - state.startY.current);
  if (
    event.clientY >= state.originBox.current.top &&
    event.clientY <= state.originBox.current.bottom
  ) {
    state.target.current = index;
    state.setOver(index);
    return;
  }
  for (const [position, row] of state.rows) {
    if (position === index) continue;
    const box = row.getBoundingClientRect();
    if (event.clientY >= box.top && event.clientY <= box.bottom) {
      state.target.current = position;
      state.setOver(position);
      break;
    }
  }
}

function scrollDraggedRow(event: React.PointerEvent<HTMLFieldSetElement>) {
  let scroll = event.currentTarget.parentElement;
  while (scroll && !['auto', 'scroll'].includes(getComputedStyle(scroll).overflowY))
    scroll = scroll.parentElement;
  if (!scroll) return;
  const box = scroll.getBoundingClientRect();
  if (event.clientY > box.bottom - 60) scroll.scrollTop += 18;
  else if (event.clientY < box.top + 60) scroll.scrollTop -= 18;
}

// Raise the FlatList cell itself: an inner z-index cannot escape its cell's stacking context.
function DragCell({
  index,
  children,
  style,
  onLayout,
  onFocusCapture,
}: Readonly<CellRendererProps<unknown>>) {
  const active = useContext(ActiveCell);
  return (
    <View
      onLayout={onLayout}
      {...{ onFocusCapture }}
      style={[style, { zIndex: active === index ? 1 : 0, overflow: 'visible' }]}
    >
      {children}
    </View>
  );
}

/** Pointer capture supports mouse and touch without the browser's native HTML drag image. */
export default function ExerciseDragList<T>(props: DraggableFlatListProps<T>) {
  const p = usePalette();
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdOrigin = useRef({ x: 0, y: 0 });
  const pendingMouse = useRef<{ x: number; y: number; begin: () => void } | null>(null);
  const suppressClick = useRef(false);
  function clearHold() {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  }
  const rows = useRef(new Map<number, HTMLFieldSetElement>());
  const source = useRef<number | null>(null);
  const target = useRef<number | null>(null);
  const startY = useRef(0);
  const originBox = useRef({ top: 0, bottom: 0 });
  const [active, setActive] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const release = () => {
      pendingMouse.current = null;
      clearHold();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      source.current = null;
      release();
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, []);
  function finish(cancelled = false) {
    clearHold();
    pendingMouse.current = null;
    if (cancelled) suppressClick.current = false;
    const from = source.current;
    if (from === null) return;
    const to = cancelled ? from : (target.current ?? from);
    source.current = null;
    target.current = null;
    setActive(null);
    setOver(null);
    setOffset(0);
    const data = [...props.data];
    const [item] = data.splice(from, 1);
    data.splice(to, 0, item);
    props.onDragEnd?.({ data, from, to });
    // A moved pointer may produce no click; never swallow the next deliberate tap.
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }
  return (
    <ActiveCell.Provider value={active}>
      <FlatList
        CellRendererComponent={DragCell}
        data={props.data}
        keyExtractor={props.keyExtractor}
        testID={props.testID}
        style={props.containerStyle}
        contentContainerStyle={props.contentContainerStyle}
        keyboardShouldPersistTaps={props.keyboardShouldPersistTaps}
        ListHeaderComponent={props.ListHeaderComponent}
        ListFooterComponent={props.ListFooterComponent}
        renderItem={({ item, index }) => (
          <fieldset
            aria-label={`Exercise ${index + 1}`}
            ref={(node) => {
              if (node) rows.current.set(index, node);
              else rows.current.delete(index);
            }}
            onPointerDownCapture={(event) => {
              if (event.button !== 0 || !(event.target instanceof Element)) return;
              const handle = event.target.closest('[id^="reorder-handle-"]:not(:disabled)');
              const card = event.target.closest('[id^="reorder-card-"]');
              const dragContent = event.target.closest(
                '[id$="-drag-details"], [id$="-drag-title"]',
              );
              if (
                !handle &&
                (!card ||
                  card.getAttribute('aria-disabled') === 'true' ||
                  (!dragContent && event.target.closest('input, button, [role="button"], a')))
              )
                return;
              const row = event.currentTarget;
              const pointerId = event.pointerId;
              const y = event.clientY;
              function begin() {
                hold.current = null;
                row.setPointerCapture(pointerId);
                const box = row.getBoundingClientRect();
                originBox.current = { top: box.top, bottom: box.bottom };
                startY.current = y;
                source.current = index;
                target.current = index;
                suppressClick.current = true;
                setActive(index);
                props.onDragBegin?.(index);
              }
              clearHold();
              pendingMouse.current = null;
              holdOrigin.current = { x: event.clientX, y: event.clientY };
              if (handle) {
                event.preventDefault();
                begin();
              } else if (event.pointerType === 'mouse') {
                pendingMouse.current = { x: event.clientX, y: event.clientY, begin };
              } else hold.current = setTimeout(begin, 250);
            }}
            onClickCapture={(event) => {
              if (suppressClick.current) {
                event.preventDefault();
                event.stopPropagation();
                suppressClick.current = false;
              }
            }}
            onPointerLeave={() => {
              if (source.current === null) clearHold();
            }}
            onPointerMove={(event) => {
              const pending = pendingMouse.current;
              if (
                pending &&
                Math.hypot(event.clientX - pending.x, event.clientY - pending.y) >= 4
              ) {
                pendingMouse.current = null;
                pending.begin();
              }
              if (
                source.current === null &&
                Math.hypot(
                  event.clientX - holdOrigin.current.x,
                  event.clientY - holdOrigin.current.y,
                ) > 8
              )
                clearHold();
              if (source.current === index) event.preventDefault();
              updateDrag(event, source.current ?? index, {
                rows: rows.current,
                source,
                target,
                startY,
                originBox,
                setOffset,
                setOver,
              });
            }}
            onPointerUp={(event) => {
              clearHold();
              if (source.current !== index) return;
              finish();
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onDragStart={(event) => event.preventDefault()}
            onPointerCancel={() => finish(true)}
            onLostPointerCapture={() => {
              if (source.current === index) finish(true);
            }}
            style={{
              border: 0,
              padding: 0,
              margin: 0,
              minWidth: 0,
              position: 'relative',
              zIndex: active === index ? 2 : 0,
              transform: active === index ? `translateY(${offset}px)` : undefined,
              opacity: active === index ? 0.9 : 1,
              borderRadius: 20,
              outline: over === index && active !== index ? `2px solid ${p.brand}` : undefined,
            }}
          >
            {props.renderItem({
              item,
              getIndex: () => index,
              drag: () => {},
              isActive: active === index,
            })}
          </fieldset>
        )}
      />
    </ActiveCell.Provider>
  );
}
