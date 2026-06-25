import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { PageSeo } from "@/components/seo/PageSeo";
import { SIM_CHART_PAGE_PATH } from "@/lib/simulation/chartSessionSync";
import { LiveBlockGameChartView } from "./components/LiveBlockGameChartView";

export default function PlayerChartPage() {
  return (
    <TechMediaLayout fullBleedMain hideChrome>
      <PageSeo
        config={{
          title: "Live Chart | TechantMedia",
          description: "Universal live chart for all block game activity.",
          path: SIM_CHART_PAGE_PATH,
        }}
      />
      <div className="h-screen w-full overflow-hidden">
        <LiveBlockGameChartView className="h-full" />
      </div>
    </TechMediaLayout>
  );
}
