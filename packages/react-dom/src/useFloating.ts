import {computePosition} from '@floating-ui/dom';
// @deno-types="npm:@types/react@^18.2.0"
import * as React from 'react';
// @deno-types="npm:@types/react-dom@^18.2.0"
import * as ReactDOM from 'react-dom';
import useModernLayoutEffect from 'use-isomorphic-layout-effect';

import type {
  ComputePositionConfig,
  ReferenceType,
  UseFloatingData,
  UseFloatingOptions,
  UseFloatingReturn,
} from './types.ts';
import {deepEqual} from './utils/deepEqual.ts';
import {getDPR} from './utils/getDPR.ts';
import {roundByDPR} from './utils/roundByDPR.ts';
import {useLatestRef} from './utils/useLatestRef.ts';

/**
 * Provides data to position a floating element.
 * @see https://floating-ui.com/docs/useFloating
 */
export function useFloating<RT extends ReferenceType = ReferenceType>(
  options: UseFloatingOptions = {},
): UseFloatingReturn<RT> {
  const {
    placement = 'bottom',
    strategy = 'absolute',
    middleware = [],
    platform,
    elements: {reference: externalReference, floating: externalFloating} = {},
    transform = true,
    whileElementsMounted,
    open,
  } = options;

  const [data, setData] = React.useState<UseFloatingData>({
    x: 0,
    y: 0,
    strategy,
    placement,
    middlewareData: {},
    isPositioned: false,
  });

  const [latestMiddleware, setLatestMiddleware] = React.useState(middleware);

  if (!deepEqual(latestMiddleware, middleware)) {
    setLatestMiddleware(middleware);
  }

  const [_reference, _setReference] = React.useState<RT | null>(null);
  const [_floating, _setFloating] = React.useState<HTMLElement | null>(null);

  const setReference = React.useCallback((node: RT | null) => {
    if (node !== referenceRef.current) {
      referenceRef.current = node;
      _setReference(node);
    }
  }, []);

  const setFloating = React.useCallback((node: HTMLElement | null) => {
    if (node !== floatingRef.current) {
      floatingRef.current = node;
      _setFloating(node);
    }
  }, []);

  const referenceEl = (externalReference || _reference) as RT | null;
  const floatingEl = externalFloating || _floating;

  const referenceRef = React.useRef<RT | null>(null);
  const floatingRef = React.useRef<HTMLElement | null>(null);
  const dataRef = React.useRef(data);

  const hasWhileElementsMounted = whileElementsMounted != null;
  const whileElementsMountedRef = useLatestRef(whileElementsMounted);
  const platformRef = useLatestRef(platform);

  const update = React.useCallback(() => {
    if (!referenceRef.current || !floatingRef.current) {
      return;
    }

    const config: ComputePositionConfig = {
      placement,
      strategy,
      middleware: latestMiddleware,
    };

    if (platformRef.current) {
      config.platform = platformRef.current;
    }

    computePosition(referenceRef.current, floatingRef.current, config).then(
      (data) => {
        const fullData = {...data, isPositioned: true};
        if (isMountedRef.current && !deepEqual(dataRef.current, fullData)) {
          dataRef.current = fullData;
          ReactDOM.flushSync(() => {
            setData(fullData);
          });
        }
      },
    );
  }, [latestMiddleware, placement, strategy, platformRef]);

  useModernLayoutEffect(() => {
    if (open === false && dataRef.current.isPositioned) {
      dataRef.current.isPositioned = false;
      setData((data) => ({...data, isPositioned: false}));
    }
  }, [open]);

  const isMountedRef = React.useRef(false);
  useModernLayoutEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useModernLayoutEffect(() => {
    if (referenceEl) referenceRef.current = referenceEl;
    if (floatingEl) floatingRef.current = floatingEl;

    if (referenceEl && floatingEl) {
      if (whileElementsMountedRef.current) {
        return whileElementsMountedRef.current(referenceEl, floatingEl, update);
      }

      update();
    }
  }, [
    referenceEl,
    floatingEl,
    update,
    whileElementsMountedRef,
    hasWhileElementsMounted,
  ]);

  const refs = React.useMemo(
    () => ({
      reference: referenceRef,
      floating: floatingRef,
      setReference,
      setFloating,
    }),
    [setReference, setFloating],
  );

  const elements = React.useMemo(
    () => ({reference: referenceEl, floating: floatingEl}),
    [referenceEl, floatingEl],
  );

  const floatingStyles = React.useMemo(() => {
    const initialStyles = {
      position: strategy,
      left: 0,
      top: 0,
    };

    if (!elements.floating) {
      return initialStyles;
    }

    const x = roundByDPR(elements.floating, data.x);
    const y = roundByDPR(elements.floating, data.y);

    if (transform) {
      return {
        ...initialStyles,
        transform: `translate(${x}px, ${y}px)`,
        ...(getDPR(elements.floating) >= 1.5 && {willChange: 'transform'}),
      };
    }

    return {
      position: strategy,
      left: x,
      top: y,
    };
  }, [strategy, transform, elements.floating, data.x, data.y]);

  return React.useMemo(
    () => ({
      ...data,
      update,
      refs,
      elements,
      floatingStyles,
    }),
    [data, update, refs, elements, floatingStyles],
  );
}
