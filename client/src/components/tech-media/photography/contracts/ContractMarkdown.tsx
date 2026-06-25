import { Streamdown } from "streamdown";
import { splitContractSections } from "@/lib/contracts/contractMarkdownUtils";

type Props = {
  markdown: string;
};

export function ContractMarkdown({ markdown }: Props) {
  const sections = splitContractSections(markdown);
  if (!sections.length) return null;

  return (
    <div className="contract-markdown">
      {sections.map((section, i) => (
        <div key={i} className="contract-print-block">
          <Streamdown>{section}</Streamdown>
        </div>
      ))}
    </div>
  );
}
