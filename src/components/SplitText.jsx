'use client';

import { useRef, useEffect, useMemo } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const splitTextContent = (text, splitType) => {
  if (!text) return [];

  if (splitType.includes('words') && !splitType.includes('chars')) {
    const words = text.split(/(\s+)/);
    return words.map((part, idx) => ({
      key: `word-${idx}`,
      content: part,
      className: /\s+/.test(part) ? 'split-space' : 'split-word'
    }));
  }

  return Array.from(text).map((char, idx) => ({
    key: `char-${idx}`,
    content: char === ' ' ? '\u00A0' : char,
    className: char === ' ' ? 'split-space' : 'split-char'
  }));
};

const SplitText = ({
  text,
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign = 'center',
  tag = 'p',
  onLetterAnimationComplete = undefined
}) => {
  const ref = useRef(null);
  const animationCompletedRef = useRef(false);
  const onCompleteRef = useRef(onLetterAnimationComplete);
  const segments = useMemo(() => splitTextContent(text, splitType), [text, splitType]);

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete;
  }, [onLetterAnimationComplete]);

  useGSAP(
    () => {
      if (!ref.current || !text) return;
      // Prevent re-animation if already completed
      if (animationCompletedRef.current) return;
      const el = ref.current;

      const startPct = (1 - threshold) * 100;
      const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
      const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0;
      const marginUnit = marginMatch ? marginMatch[2] || 'px' : 'px';
      const sign =
        marginValue === 0
          ? ''
          : marginValue < 0
            ? `-=${Math.abs(marginValue)}${marginUnit}`
            : `+=${marginValue}${marginUnit}`;
      const start = `top ${startPct}%${sign}`;

      const selector = splitType.includes('words') && !splitType.includes('chars') ? '.split-word' : '.split-char';
      const targets = el.querySelectorAll(selector);
      if (!targets.length) return;

      gsap.set(targets, { ...from });
      const tween = gsap.to(targets, {
        ...to,
        duration,
        ease,
        stagger: delay / 1000,
        scrollTrigger: {
          trigger: el,
          start,
          once: true,
          fastScrollEnd: true,
          anticipatePin: 0.4
        },
        onComplete: () => {
          animationCompletedRef.current = true;
          onCompleteRef.current?.();
        },
        willChange: 'transform, opacity',
        force3D: true
      });

      return () => {
        ScrollTrigger.getAll().forEach(st => {
          if (st.trigger === el) st.kill();
        });
        tween.kill();
      };
    },
    {
      dependencies: [
        text,
        delay,
        duration,
        ease,
        splitType,
        JSON.stringify(from),
        JSON.stringify(to),
        threshold,
        rootMargin,
        segments.length
      ],
      scope: ref
    }
  );

  const renderTag = () => {
    const style = {
      textAlign,
      overflow: 'hidden',
      display: 'block',
      whiteSpace: 'normal',
      wordWrap: 'break-word',
      willChange: 'transform, opacity'
    };
    const classes = `split-parent ${className}`;
    const Tag = tag || 'p';

    return (
      <Tag ref={ref} style={style} className={classes}>
        {splitType.includes('words') && !splitType.includes('chars')
          ? segments.map(segment =>
              segment.className === 'split-space' ? (
                segment.content
              ) : (
                <span
                  key={segment.key}
                  className={segment.className}
                  style={{ display: 'inline-block', whiteSpace: 'nowrap' }}
                >
                  {segment.content}
                </span>
              )
            )
          : segments.map(segment => (
              <span
                key={segment.key}
                className={segment.className}
                style={{ display: 'inline-block', whiteSpace: 'pre' }}
              >
                {segment.content}
              </span>
            ))}
      </Tag>
    );
  };
  return renderTag();
};

export default SplitText;
