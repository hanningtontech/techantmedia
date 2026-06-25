import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PhotoCategory, PhotographySettings } from "@/lib/portfolio/portfolioTypes";
import { ContractInfoLink } from "@/components/tech-media/photography/contracts/ContractInfoLink";
import { buildBookingMessage, buildWhatsAppUrl, normalizeWhatsAppNumber } from "@/lib/tech-media/whatsapp";

export type BookingSessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: PhotographySettings;
  brandName: string;
  brandPhone: string;
  photoCategories: PhotoCategory[];
  extraOptions?: string[];
};

export function BookingSessionDialog({
  open,
  onOpenChange,
  settings,
  brandName,
  brandPhone,
  photoCategories,
  extraOptions = [],
}: BookingSessionDialogProps) {
  const [service, setService] = useState("");
  const [name, setName] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");

  const serviceOptions = useMemo(() => {
    const fromCats = photoCategories.filter((c) => c.visible).map((c) => c.label);
    const extras = ["Videography", "Custom / Not sure", ...extraOptions];
    return [...new Set([...fromCats, ...extras])];
  }, [photoCategories, extraOptions]);

  const whatsappNumber =
    normalizeWhatsAppNumber(settings.whatsappNumber) || normalizeWhatsAppNumber(brandPhone);

  const handleBook = () => {
    if (!whatsappNumber) return;
    const selected = service || serviceOptions[0] || "Photography session";
    const message = buildBookingMessage({
      brandName,
      service: selected,
      name,
      preferredDate,
      notes,
    });
    const url = buildWhatsAppUrl(whatsappNumber, message);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto border-white/10 bg-[#12121a] text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Book a session</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {settings.bookingIntro ||
              "Tell us what you need—we'll reply on WhatsApp with availability and next steps."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">What do you need?</label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger className="w-full border-white/15 bg-white/5">
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {serviceOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Your name (optional)</label>
              <input
                className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Preferred date (optional)</label>
              <input
                type="date"
                className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Notes (optional)</label>
            <textarea
              className="min-h-[88px] w-full resize-y rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Location, guest count, style references…"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ContractInfoLink slug="photography-videography" className="sm:flex-1" />
            <button
              type="button"
              disabled={!whatsappNumber}
              onClick={handleBook}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageCircle size={20} />
              Continue on WhatsApp
            </button>
          </div>
          {!whatsappNumber ? (
            <p className="text-sm text-amber-400/90">Booking is unavailable until a WhatsApp number is configured.</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
