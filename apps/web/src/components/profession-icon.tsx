import {
  Apple,
  Brain,
  BriefcaseMedical,
  ClipboardList,
  FlaskConical,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  HeartPulse,
  Landmark,
  PawPrint,
  PersonStanding,
  Pill,
  Stethoscope,
  Store,
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
  Veterinária: PawPrint,
  "Assistência Social": HeartHandshake,
  Formação: GraduationCap,
  "Comercial / Farma": Store,
  "Gestão & suporte": ClipboardList,
  Administrativo: ClipboardList,
};

/**
 * Ícone da profissão (o mesmo no cartão e no cabeçalho da vaga).
 * `concurso` usa o ícone institucional, como nas maquetas, para os procedimentos públicos.
 */
export function JobIcon({
  profession,
  concurso = false,
  large = false,
}: {
  profession: string;
  concurso?: boolean;
  large?: boolean;
}) {
  const Icon = concurso ? Landmark : (ICONS[profession] ?? BriefcaseMedical);
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
