import {
  Apple,
  Brain,
  BriefcaseMedical,
  ClipboardList,
  FlaskConical,
  HandHeart,
  HeartHandshake,
  GraduationCap,
  HeartPulse,
  Landmark,
  PersonStanding,
  Pill,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Enfermagem: HeartPulse,
  Medicina: Stethoscope,
  Fisioterapia: PersonStanding,
  Auxiliares: HandHeart,
  "Técnico de Saúde": FlaskConical,
  Farmácia: Pill,
  Psicologia: Brain,
  Nutrição: Apple,
  "Assistência Social": HeartHandshake,
  Formação: GraduationCap,
  "Comercial / Farma": BriefcaseMedical,
  "Gestão & suporte": ClipboardList,
  Administrativo: ClipboardList,
};

/**
 * Ícone da profissão (o mesmo no cartão e no topo da página da vaga).
 * `concorso` usa o ícone institucional, como nas maquetes, para os editais públicos.
 */
export function JobIcon({
  profession,
  concorso = false,
  large = false,
}: {
  profession: string;
  concorso?: boolean;
  large?: boolean;
}) {
  const Icon = concorso ? Landmark : (ICONS[profession] ?? BriefcaseMedical);
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-primary-soft text-primary ${
        large ? "h-12 w-12 rounded-2xl sm:h-14 sm:w-14" : "h-11 w-11 rounded-xl"
      }`}
    >
      <Icon size={large ? 26 : 22} strokeWidth={large ? 1.7 : 1.8} aria-hidden="true" />
    </span>
  );
}

export function professionIcon(profession: string): LucideIcon {
  return ICONS[profession] ?? BriefcaseMedical;
}
