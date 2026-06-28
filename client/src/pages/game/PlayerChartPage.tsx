import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { PageSeo } from "@/components/seo/PageSeo";
import { Button } from "@/components/ui/button";
import { LiveBlockGameChartView } from "./components/LiveBlockGameChartView";

export default function PlayerChartPage() {
  return (
    <TechMediaLayout fullBleedMain hideChrome>
      <PageSeo
        config={{
          title: "Live Chart | TechantMedia",
          description: "Universal live chart for all block game activity.",
          path: "/game/chart",
        }}
      />
      <div className="flex h-svh max-h-svh w-full flex-col overflow-hidden bg-[#06060a]">
        <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
          <Link href="/game">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-zinc-300 hover:text-white"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Back to game
            </Button>
          </Link>
          <span className="text-sm font-medium text-zinc-200">Live chart</span>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <LiveBlockGameChartView className="h-full" />
        </div>
      </div>
    </TechMediaLayout>
  );
}
