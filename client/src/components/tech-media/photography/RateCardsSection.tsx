import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PhotographySettings, RateCardGroup } from "@/lib/portfolio/portfolioTypes";
import { buildInquiryMessage, buildWhatsAppUrl, normalizeWhatsAppNumber } from "@/lib/tech-media/whatsapp";

type Props = {
  groups: RateCardGroup[];
  settings: PhotographySettings;
  brandName: string;
  brandPhone: string;
};

export function RateCardsSection({ groups, settings, brandName, brandPhone }: Props) {
  const sorted = [...groups].sort((a, b) => a.order - b.order);
  const defaultTab = sorted[0]?.id ?? "rates";
  const whatsappNumber =
    normalizeWhatsAppNumber(settings.whatsappNumber) || normalizeWhatsAppNumber(brandPhone);

  const inquire = (packageName: string, groupLabel: string, price: string) => {
    if (!whatsappNumber) return;
    const message = buildInquiryMessage({ brandName, packageName, groupLabel, price });
    const url = buildWhatsAppUrl(whatsappNumber, message);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!sorted.length) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <h2 className="text-2xl font-bold text-white sm:text-3xl">Rate card</h2>
        <p className="mt-2 tm-muted">Transparent packages—custom quotes available on request.</p>
      </motion.div>

      <Tabs defaultValue={defaultTab} className="mt-8">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-white/5 border border-white/10 p-1">
          {sorted.map((g) => (
            <TabsTrigger key={g.id} value={g.id} className="text-sm">
              {g.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {sorted.map((group) => (
          <TabsContent key={group.id} value={group.id} className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {group.packages.map((row) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className={`tm-card-hover flex flex-col rounded-2xl border bg-[#12121a] p-6 ${
                    row.highlight ? "border-orange-500/50 ring-1 ring-orange-500/20" : "border-white/10 hover:border-orange-500/40"
                  }`}
                >
                  <p className="text-lg font-bold text-orange-400">{row.price}</p>
                  <h3 className="mt-2 font-semibold text-white">{row.name}</h3>
                  <p className="mt-2 flex-1 text-sm tm-muted">{row.detail}</p>
                  <button
                    type="button"
                    disabled={!whatsappNumber}
                    onClick={() => inquire(row.name, group.label, row.price)}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2 text-sm font-medium text-[#25D366] transition-all hover:bg-[#25D366]/20 disabled:opacity-50"
                  >
                    <MessageCircle size={16} />
                    Inquire on WhatsApp
                  </button>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {whatsappNumber && (
        <p className="mt-8 text-center text-sm tm-muted">
          Need something custom?{" "}
          <button
            type="button"
            className="font-medium text-orange-400 hover:underline"
            onClick={() =>
              inquire("Custom package", "General inquiry", "Custom")
            }
          >
            Message us on WhatsApp
          </button>
        </p>
      )}
    </section>
  );
}
