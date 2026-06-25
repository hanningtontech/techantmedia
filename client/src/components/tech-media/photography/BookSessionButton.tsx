import { useState } from "react";
import { Calendar } from "lucide-react";
import { BookingSessionDialog } from "@/components/tech-media/photography/BookingSessionDialog";
import type { PhotoCategory, PhotographySettings } from "@/lib/portfolio/portfolioTypes";
import { cn } from "@/lib/utils";

type Props = {
  settings: PhotographySettings;
  brandName: string;
  brandPhone: string;
  photoCategories: PhotoCategory[];
  extraOptions?: string[];
  className?: string;
  /** Visible helper line under the button (booking intro from CMS). */
  hintClassName?: string;
};

export function BookSessionButton({
  settings,
  brandName,
  brandPhone,
  photoCategories,
  extraOptions,
  className,
  hintClassName,
}: Props) {
  const [open, setOpen] = useState(false);

  if (!settings.whatsappBookingEnabled) return null;

  const hint =
    settings.bookingIntro.trim() ||
    "Opens a short form, then continues on WhatsApp to confirm your session.";

  return (
    <>
      <div className={cn("pointer-events-auto", className)}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-describedby="book-session-hint"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-orange-500/25 transition-transform hover:scale-[1.02] hover:bg-orange-400"
        >
          <Calendar size={18} aria-hidden />
          Book a session
        </button>
        <p id="book-session-hint" className={cn("mt-2 max-w-md text-sm text-zinc-400", hintClassName)}>
          {hint}
        </p>
      </div>

      <BookingSessionDialog
        open={open}
        onOpenChange={setOpen}
        settings={settings}
        brandName={brandName}
        brandPhone={brandPhone}
        photoCategories={photoCategories}
        extraOptions={extraOptions}
      />
    </>
  );
}
