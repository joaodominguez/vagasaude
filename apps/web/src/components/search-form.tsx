import { MapPin, Search } from "lucide-react";
import { districts } from "@/lib/jobs";

export function SearchForm({
  defaultQuery = "",
  defaultDistrict = "",
  compact = false,
}: {
  defaultQuery?: string;
  defaultDistrict?: string;
  compact?: boolean;
}) {
  return (
    <form
      action="/vagas"
      className={compact ? "search-form search-form-compact" : "search-form"}
    >
      <label className="search-field min-w-0 flex-1">
        <Search aria-hidden="true" size={19} />
        <span className="sr-only">Profissão ou palavra-chave</span>
        <input
          name="q"
          defaultValue={defaultQuery}
          placeholder="Profissão, especialidade ou palavra-chave"
        />
      </label>
      <label className="search-field md:max-w-58">
        <MapPin aria-hidden="true" size={19} />
        <span className="sr-only">Distrito</span>
        <select name="distrito" defaultValue={defaultDistrict}>
          <option value="">Todo o país</option>
          {districts.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-primary whitespace-nowrap" type="submit">
        Encontrar vagas
      </button>
    </form>
  );
}
