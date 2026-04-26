import { Badge } from "@/components/ui/badge";

type Props = {
  matched: string[];
  available?: string[];
};

export function KeywordVisualization({ matched, available }: Props) {
  const set = new Set(matched.map((k) => k.toLowerCase()));
  const pool = available?.length ? available : matched;
  return (
    <div className="flex flex-wrap gap-2">
      {pool.map((kw) => (
        <Badge key={kw} variant={set.has(kw.toLowerCase()) ? "default" : "secondary"}>
          {kw}
        </Badge>
      ))}
    </div>
  );
}
