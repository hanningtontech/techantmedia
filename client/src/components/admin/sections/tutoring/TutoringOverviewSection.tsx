import { Link } from "wouter";
import { AdminPage } from "@/components/admin/shared/AdminPage";

export function TutoringOverviewSection() {
  return (
    <AdminPage
      title="NCLEX tutoring"
      description="Quizzes, students, and tutoring sessions are managed in the NCLEX tutor dashboard."
    >
      <div className="admin-panel max-w-xl p-6">
        <p className="text-zinc-300">
          Open the tutor area to manage question banks, student approvals, tutoring sessions, and class presentations.
        </p>
        <Link
          href="/tutor/nclex"
          className="mt-6 inline-flex rounded-full bg-violet-500 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-400"
        >
          Go to tutor dashboard
        </Link>
      </div>
    </AdminPage>
  );
}
