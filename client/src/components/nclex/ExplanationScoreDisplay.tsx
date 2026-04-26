import { Progress } from "@/components/ui/progress";

type Props = {
  score: number;
  label?: string;
};

export function ExplanationScoreDisplay({ score, label = "Explanation score" }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-gray-600">
        <span>{label}</span>
        <span className="font-semibold text-gray-900">{clamped}%</span>
      </div>
      <Progress value={clamped} />
    </div>
  );
}
