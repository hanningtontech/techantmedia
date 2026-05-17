import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PhotoCategory, PhotographySettings } from "@/lib/portfolio/portfolioTypes";
import { buildBookingMessage, buildWhatsAppUrl, normalizeWhatsAppNumber } from "@/lib/tech-media/whatsapp";

type Props = {
  settings: PhotographySettings;
  brandName: string;
  brandPhone: string;
  photoCategories: PhotoCategory[];
  extraOptions?: string[];
};

export function WhatsAppBooking({ settings, brandName, brandPhone, photoCategories, extraOptions = [] }: Props) {
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

  if (!settings.whatsappBookingEnabled) return null;

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
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="border-y border-white/10 bg-gradient-to-b from-orange-500/5 to-transparent">
      <motion.div
        className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <h2 className="text-2xl font-bold text-white sm:text-3xl">Book a session</h2>
        <p className="mt-2 tm-muted">{settings.bookingIntro}</p>

        <motion.div
          className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-[#12121a] p-6 sm:p-8"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
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
            <motion.div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Your name (optional)</label>
              <input
                className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </motion.div>
            <motion.div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Preferred date (optional)</label>
              <input
                type="date"
                className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
              />
            </motion.div>
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

          <button
            type="button"
            disabled={!whatsappNumber}
            onClick={handleBook}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
          >
            <MessageCircle size={20} />
            Book on WhatsApp
          </button>
          {!whatsappNumber && (
            <p className="text-sm text-amber-400/90">Add a WhatsApp number in admin to enable booking.</p>
          )}
        </motion.div>
      </motion.div>
    </section>
  );
}
