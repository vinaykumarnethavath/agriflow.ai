"use client";

import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import api from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Global client-side translation cache (survives re-renders within a session)
// Key: `${locale}::${sourceText}`, Value: translated string
// ─────────────────────────────────────────────────────────────────────────────
const translationCache = new Map<string, string>();

// Pending batch queue: before sending requests we collect all pending
// translations in a microtask-debounced batch.
let batchQueue: Array<{
  text: string;
  locale: string;
  resolve: (val: string) => void;
}> = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

async function flushBatch() {
  if (batchQueue.length === 0) return;
  const items = [...batchQueue];
  batchQueue = [];

  // Group by locale
  const byLocale = new Map<string, typeof items>();
  for (const item of items) {
    if (!byLocale.has(item.locale)) byLocale.set(item.locale, []);
    byLocale.get(item.locale)!.push(item);
  }

  for (const [locale, group] of byLocale) {
    // Chunk into batches of 50 to respect backend validation limit
    const chunkSize = 50;
    for (let i = 0; i < group.length; i += chunkSize) {
      const chunk = group.slice(i, i + chunkSize);
      const texts = chunk.map((g) => g.text);
      try {
        const { data } = await api.post("/api/translate", {
          texts,
          target_lang: locale,
          source_lang: "en",
        });
        const translations: string[] = data?.translations || texts;
        chunk.forEach((item, idx) => {
          const translated = translations[idx] || item.text;
          translationCache.set(`${locale}::${item.text}`, translated);
          item.resolve(translated);
        });
      } catch (err) {
        // On error, resolve with original
        chunk.forEach((item) => item.resolve(item.text));
      }
    }
  }
}

function scheduleTranslate(text: string, locale: string): Promise<string> {
  const cacheKey = `${locale}::${text}`;
  if (translationCache.has(cacheKey)) {
    return Promise.resolve(translationCache.get(cacheKey)!);
  }
  return new Promise((resolve) => {
    batchQueue.push({ text, locale, resolve });
    if (batchTimer) clearTimeout(batchTimer);
    // Debounce 60ms — collect all items rendered in the same frame
    batchTimer = setTimeout(flushBatch, 60);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// <T> component — Static dictionary lookup + dynamic AI fallback
// ─────────────────────────────────────────────────────────────────────────────

interface TProps {
  k?: string;       // Optional static dictionary key  e.g. "sidebar.dashboard"
  children: string; // English source text
}

/**
 * <T> — Dynamic & Static Translation component.
 *
 * Usage:
 *   Static:  <T k="farmer.activeCrops">Active Crops</T>
 *   Dynamic: <T>Welcome back, Ramesh!</T>  ← AI translates at runtime
 */
export function T({ k, children }: TProps) {
  const { locale, t } = useLanguage();
  const [translatedText, setTranslatedText] = useState<string>(children);
  const [loading, setLoading] = useState<boolean>(false);
  const prevLocale = useRef<string>(locale);
  const prevChildren = useRef<string>(children);

  // Static dictionary lookup
  const staticTranslation = k ? t(k) : undefined;
  const isStaticAvailable = !!staticTranslation && staticTranslation !== k;

  useEffect(() => {
    // No-op if nothing changed
    if (prevLocale.current === locale && prevChildren.current === children && translatedText !== children) {
      return;
    }
    prevLocale.current = locale;
    prevChildren.current = children;

    // English or static translation available → use immediately
    if (locale === "en" || isStaticAvailable) {
      setTranslatedText(isStaticAvailable ? staticTranslation! : children);
      setLoading(false);
      return;
    }

    // Empty string guard
    if (!children?.trim()) {
      setTranslatedText(children);
      return;
    }

    // Check cache first (synchronous)
    const cacheKey = `${locale}::${children}`;
    if (translationCache.has(cacheKey)) {
      setTranslatedText(translationCache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    // Schedule batched AI translation
    let isMounted = true;
    setLoading(true);
    scheduleTranslate(children, locale).then((result) => {
      if (isMounted) {
        setTranslatedText(result);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [children, locale, isStaticAvailable, staticTranslation]);

  return (
    <span
      className={
        loading
          ? "opacity-50 transition-opacity duration-200 animate-pulse"
          : "transition-opacity duration-200"
      }
    >
      {translatedText}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useBatchTranslate — Hook for translating an array of strings at once
// Returns { translations, loading }
// ─────────────────────────────────────────────────────────────────────────────

export function useBatchTranslate(texts: string[]): {
  translations: string[];
  loading: boolean;
} {
  const { locale } = useLanguage();
  const [translations, setTranslations] = useState<string[]>(texts);
  const [loading, setLoading] = useState(false);
  const keyRef = useRef<string>("");

  useEffect(() => {
    const key = `${locale}::${texts.join("|")}`;
    if (keyRef.current === key) return;
    keyRef.current = key;

    if (locale === "en" || texts.length === 0) {
      setTranslations(texts);
      setLoading(false);
      return;
    }

    // Check if all are cached
    const cached = texts.map((t) => translationCache.get(`${locale}::${t}`));
    if (cached.every(Boolean)) {
      setTranslations(cached as string[]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    Promise.all(texts.map((text) => scheduleTranslate(text, locale))).then(
      (results) => {
        if (isMounted) {
          setTranslations(results);
          setLoading(false);
        }
      }
    );
    return () => { isMounted = false; };
  }, [locale, texts.join("|")]);

  return { translations, loading };
}

/**
 * useT — Hook returning the static t() function.
 */
export function useT() {
  const { t } = useLanguage();
  return t;
}
