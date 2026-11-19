import {
  Apple,
  Brain,
  BriefcaseMedical,
  ClipboardList,
  FlaskConical,
  Glasses,
  HandHeart,
  HeartHandshake,
  HeartPulse,
  Landmark,
  PawPrint,
  PersonStanding,
  Pill,
  Smile,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Enfermería: HeartPulse,
  Medicina: Stethoscope,
  TCAE: HandHeart,
  Fisioterapia: PersonStanding,
  "Técnico sanitario": FlaskConical,
  Farmacia: Pill,
  "Técnico de farmacia": Pill,
  Celador: HeartHandshake,
  Psicología: Brain,
  Nutrición: Apple,
  Odontología: Smile,
  "Óptica y audiología": Glasses,
  Veterinaria: PawPrint,
  "Trabajo social": HeartHandshake,
  Formación: ClipboardList,
  "Gestión y apoyo": ClipboardList,
  Administrativo: ClipboardList,
};

/**
 * Icono de la profesión (el mismo en la tarjeta y en la cabecera de la oferta).
 * `concorso` usa el icono institucional, como en las maquetas, para las convocatorias públicas.
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
