import { Redirect } from "wouter";
import { SIM_CHART_PAGE_PATH } from "@/lib/simulation/chartSessionSync";

/** Legacy path — same universal chart as /game/chart. */
export default function SimulationChartPage() {
  return <Redirect to={SIM_CHART_PAGE_PATH} />;
}
