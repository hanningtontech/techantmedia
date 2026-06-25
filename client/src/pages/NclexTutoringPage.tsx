import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SeoFaqSection } from "@/components/seo/SeoFaqSection";
import { getNclexAppUrl } from "@/const/nclexLiveUrl";
import { appUrl } from "@/lib/seo/appOrigin";
import { NCLEX_FAQ } from "@/lib/seo/siteSeo";
import { ArrowLeft, BarChart3, BookOpen, CheckCircle, ExternalLink, Mail, Users } from "lucide-react";

const nclexAppUrl = getNclexAppUrl();

export default function NclexTutoringPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/80 via-white to-gray-50 text-gray-900">
      <header className="sticky top-0 z-40 border-b border-orange-100/80 bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Button type="button" variant="ghost" className="gap-2 text-gray-700" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
            Portfolio
          </Button>
          {nclexAppUrl ? (
            <Button asChild className="bg-orange-600 hover:bg-orange-700">
              <a href={nclexAppUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                Open NCLEX app
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </div>
      </header>

      <main className="container py-12 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
            <BookOpen className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">Tutoring add-on</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">NCLEX practice platform</h1>
          <p className="mt-4 text-lg text-gray-600">
            This page is part of my portfolio and points to the dedicated NCLEX practice app: question banks, rationales,
            progress tracking, and admin review—built for serious exam prep and tutor-led cohorts.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {nclexAppUrl ? (
              <Button asChild size="lg" className="w-full bg-orange-600 hover:bg-orange-700 sm:w-auto">
                <a href={nclexAppUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                  Launch practice app
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : (
              <p className="text-sm text-gray-600">
                Set <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">VITE_NCLEX_APP_URL</code> in{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">.env</code> to show a launch button for your deployed
                build.
              </p>
            )}
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <a href="mailto:hanningtonkuria5@mail.com?subject=NCLEX%20tutoring%20inquiry" className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Tutoring inquiry
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary" className="w-full border-orange-200 bg-white sm:w-auto">
              <a href={appUrl("/tutor/nclex/quizzes")}>Tutor admin — quizzes and bank</a>
            </Button>
          </div>
        </div>

        {!nclexAppUrl ? (
          <Card className="mx-auto mt-10 max-w-2xl border-orange-100 bg-white/80">
            <CardHeader>
              <CardTitle className="text-lg">Run the app from the repo</CardTitle>
              <CardDescription>
                The full stack lives in <code className="text-xs">nclex_practice_app</code> next to this portfolio. Start it
                locally, then paste its URL into <code className="text-xs">VITE_NCLEX_APP_URL</code> for one-click access from
                here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <p>
                From the <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">nclex_practice_app</code> folder: install
                dependencies, configure env as in that project, then <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">pnpm dev</code>.
                The server picks an available port (often <code className="text-xs">3000</code> unless your portfolio dev server
                already uses it—in that case set <code className="text-xs">PORT</code> for the NCLEX app).
              </p>
            </CardContent>
          </Card>
        ) : null}

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-gray-200 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <BookOpen className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Comprehensive questions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Curated NCLEX-style items across major content areas so students drill what matters.
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <CheckCircle className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Detailed rationales</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Explanations reinforce clinical judgment—not just whether an option was right or wrong.
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                <BarChart3 className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Performance tracking</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Progress and analytics help learners and tutors spot weak domains early.
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                <Users className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Admin review</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Educators can review attempts and written work to give targeted feedback.
            </CardContent>
          </Card>
        </div>

        <Card className="mx-auto mt-14 max-w-4xl border-gray-200">
          <CardHeader>
            <CardTitle className="text-center text-2xl">How it works</CardTitle>
            <CardDescription className="text-center text-base">
              Same flow as the standalone NCLEX app—optimized for self-study and tutor-supported groups.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                { step: "1", title: "Sign in", body: "Students and admins use secure login to reach the right dashboard." },
                { step: "2", title: "Practice", body: "Work questions at your pace, with optional written explanations where enabled." },
                { step: "3", title: "Review & learn", body: "Instant scoring, rationales, and tutor review close the feedback loop." },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{item.body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      <SeoFaqSection items={NCLEX_FAQ} variant="light" />

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500">
        NCLEX practice app source: <code className="text-xs text-gray-700">nclex_practice_app</code> in this workspace.
      </footer>
    </div>
  );
}
