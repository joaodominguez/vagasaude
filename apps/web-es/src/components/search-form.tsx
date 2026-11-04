"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search } from "lucide-react";
import { districts } from "@/lib/jobs";

type SearchSuggestion = {
  label: string;
  value: string;
  kind: "profession" | "district" | "role" | "company";
  href?: string;
  hint?: string;
};

type Props = {
  defaultQuery?: string;
  defaultDistrict?: string;
  compact?: boolean;
};

const KIND_LABEL: Record<SearchSuggestion["kind"], string> = {
  profession: "Profesión",
  district: "Comunidad",
  role: "Puesto",
  company: "Entidad",
};

export function SearchForm({
  defaultQuery = "",
  defaultDistrict = "",
  compact = false,
}: Props) {
  const router = useRouter();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLLabelElement>(null);
  const [query, setQuery] = useState(defaultQuery);
  const [district, setDistrict] = useState(defaultDistrict);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  function updateMenuBox() {
    const el = fieldRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuBox({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  }

  // Sincroniza el estado con las props durante el render (patrón recomendado
  // por React en lugar de un efecto con setState).
  const [prevDefaultQuery, setPrevDefaultQuery] = useState(defaultQuery);
  if (prevDefaultQuery !== defaultQuery) {
    setPrevDefaultQuery(defaultQuery);
    setQuery(defaultQuery);
  }
  const [prevDefaultDistrict, setPrevDefaultDistrict] = useState(defaultDistrict);
  if (prevDefaultDistrict !== defaultDistrict) {
    setPrevDefaultDistrict(defaultDistrict);
    setDistrict(defaultDistrict);
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: SearchSuggestion[] };
        setSuggestions(data.suggestions ?? []);
        setActiveIndex(-1);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 160);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Medición asíncrona: evita setState síncrono dentro del efecto.
    const frame = requestAnimationFrame(updateMenuBox);
    function onReposition() {
      updateMenuBox();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, suggestions.length, query]);

  function goToSearch(nextQuery: string, nextDistrict: string) {
    const params = new URLSearchParams();
    const trimmed = nextQuery.trim();
    if (trimmed) params.set("q", trimmed);
    if (nextDistrict) params.set("comunidad", nextDistrict);
    const qs = params.toString();
    router.push(qs ? `/empleo?${qs}` : "/empleo");
  }

  function applySuggestion(item: SearchSuggestion) {
    setOpen(false);
    setActiveIndex(-1);
    if (item.kind === "district") {
      setDistrict(item.value);
      setQuery("");
      router.push(item.href ?? `/empleo?comunidad=${encodeURIComponent(item.value)}`);
      return;
    }
    if (item.kind === "profession") {
      setQuery("");
      router.push(
        item.href ?? `/empleo?profesion=${encodeURIComponent(item.value)}`,
      );
      return;
    }
    setQuery(item.value);
    if (item.href) {
      router.push(item.href);
      return;
    }
    goToSearch(item.value, district);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOpen(false);
    goToSearch(query, district);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (event.key === "ArrowDown" && suggestions.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        event.preventDefault();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      applySuggestion(suggestions[activeIndex]!);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <form
      className={compact ? "search-form search-form-compact" : "search-form"}
      onSubmit={onSubmit}
      role="search"
    >
      <div className="search-suggest min-w-0 flex-1" ref={wrapRef}>
        <label className="search-field" ref={fieldRef}>
          <Search aria-hidden="true" size={19} />
          <span className="sr-only">Profesión o palabra clave</span>
          <input
            name="q"
            type="search"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
            }
            placeholder="Profesión, especialidad o palabra clave"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              requestAnimationFrame(updateMenuBox);
            }}
            onKeyDown={onKeyDown}
          />
        </label>
        {open && menuBox && suggestions.length > 0 ? (
          <ul
            id={listId}
            className="search-suggest-list"
            role="listbox"
            aria-label="Sugerencias de búsqueda"
            style={{
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
            }}
          >
            {suggestions.map((item, index) => (
              <li key={`${item.kind}:${item.value}`} role="presentation">
                <button
                  type="button"
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={
                    index === activeIndex
                      ? "search-suggest-item is-active"
                      : "search-suggest-item"
                  }
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applySuggestion(item)}
                >
                  <span className="search-suggest-kind">
                    {item.hint ?? KIND_LABEL[item.kind]}
                  </span>
                  <span className="search-suggest-label">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {open &&
        menuBox &&
        !loading &&
        suggestions.length === 0 &&
        query.trim().length >= 2 ? (
          <div
            className="search-suggest-empty"
            role="status"
            style={{
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
            }}
          >
            Sin sugerencias: pulsa Intro para buscar.
          </div>
        ) : null}
      </div>

      <label className="search-field md:max-w-58">
        <MapPin aria-hidden="true" size={19} />
        <span className="sr-only">Comunidad autónoma</span>
        <select
          name="comunidad"
          value={district}
          onChange={(event) => setDistrict(event.target.value)}
        >
          <option value="">Toda España</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-primary whitespace-nowrap" type="submit">
        Buscar empleo
      </button>
    </form>
  );
}
