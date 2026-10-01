import { Check } from "lucide-react";
import {
  formatJobDescriptionText,
  type JobTextBlock,
} from "@/lib/format-job-text";

type Props = {
  text: string;
};

export function JobDescription({ text }: Props) {
  const blocks = formatJobDescriptionText(text);
  if (blocks.length === 0) return null;

  return (
    <div className="job-description">
      {blocks.map((block, index) => (
        <Block key={`${block.type}-${index}`} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: JobTextBlock }) {
  if (block.type === "heading") {
    return <h3 className="job-description-heading">{block.text}</h3>;
  }
  if (block.type === "list") {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>
            <Check size={17} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p>{block.text}</p>;
}
