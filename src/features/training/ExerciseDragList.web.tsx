import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { FlatList, View, type CellRendererProps } from 'react-native';
import type { DraggableFlatListProps } from 'react-native-draggable-flatlist';
import { usePalette } from '@/theme/tokens';

const ActiveCell = createContext<number | null>(null);

// Raise the FlatList cell itself: an inner z-index cannot escape its cell's stacking context.
function DragCell({
  index,
  children,
  style,
  onLayout,
  onFocusCapture,
}: CellRendererProps<unknown>) {
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
  const rows = useRef(new Map<number, HTMLDivElement>());
  const source = useRef<number | null>(null);
  const target = useRef<number | null>(null);
  const startY = useRef(0);
  const originBox = useRef({ top: 0, bottom: 0 });
  const [active, setActive] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  useEffect(
    () => () => {
      source.current = null;
    },
    [],
  );
  function finish(cancelled = false) {
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
          <div
            ref={(node) => {
              if (node) rows.current.set(index, node);
              else rows.current.delete(index);
            }}
            onPointerDownCapture={(event) => {
              if (
                event.button !== 0 ||
                !(event.target instanceof Element) ||
                !event.target.closest('[id^="reorder-handle-"]:not(:disabled)')
              )
                return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              const box = event.currentTarget.getBoundingClientRect();
              originBox.current = { top: box.top, bottom: box.bottom };
              startY.current = event.clientY;
              source.current = index;
              target.current = index;
              setActive(index);
              props.onDragBegin?.(index);
            }}
            onPointerMove={(event) => {
              if (source.current !== index) return;
              setOffset(event.clientY - startY.current);
              if (
                event.clientY >= originBox.current.top &&
                event.clientY <= originBox.current.bottom
              ) {
                target.current = index;
                setOver(index);
              } else
                for (const [position, row] of rows.current) {
                  if (position === index) continue;
                  const box = row.getBoundingClientRect();
                  if (event.clientY >= box.top && event.clientY <= box.bottom) {
                    target.current = position;
                    setOver(position);
                    break;
                  }
                }
              let scroll = event.currentTarget.parentElement;
              while (scroll && !['auto', 'scroll'].includes(getComputedStyle(scroll).overflowY))
                scroll = scroll.parentElement;
              if (scroll) {
                const box = scroll.getBoundingClientRect();
                if (event.clientY > box.bottom - 60) scroll.scrollTop += 18;
                else if (event.clientY < box.top + 60) scroll.scrollTop -= 18;
              }
            }}
            onPointerUp={(event) => {
              if (source.current !== index) return;
              finish();
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => finish(true)}
            onLostPointerCapture={() => {
              if (source.current === index) finish(true);
            }}
            style={{
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
          </div>
        )}
      />
    </ActiveCell.Provider>
  );
}
