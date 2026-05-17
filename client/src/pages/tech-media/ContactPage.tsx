import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { CONTACT_SERVICES } from "@/lib/tech-media/content";
import { toast } from "sonner";

function getInitialService(): string {
  if (typeof window === "undefined") return CONTACT_SERVICES[0];
  const q = new URLSearchParams(window.location.search).get("service");
  if (q && CONTACT_SERVICES.includes(q as (typeof CONTACT_SERVICES)[number])) return q;
  return CONTACT_SERVICES[0];
}

export default function ContactPage() {
  const { content } = useSiteContent();
  const { brand } = content;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState(getInitialService);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const subject = encodeURIComponent(`TechantMedia — ${service}`);
    const body = encodeURIComponent(`Name: ${name}\n\n${message}`);
    window.location.href = `mailto:${brand.email}?subject=${subject}&body=${body}`;
    toast.success("Opening your email app…");
    setSending(false);
  };

  return (
    <TechMediaLayout>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-bold text-white">Contact</h1>
            <p className="mt-4 text-lg text-zinc-400">
              Tell us about your shoot, build, or tutoring goals—we respond within one business day.
            </p>
            <ul className="mt-10 space-y-4 text-zinc-400">
              <li className="flex items-center gap-3">
                <Mail className="text-orange-400" size={20} />
                <a href={`mailto:${brand.email}`} className="hover:text-white transition-colors">
                  {brand.email}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="text-teal-400" size={20} />
                <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="hover:text-white transition-colors">
                  {brand.phone}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <MapPin className="text-violet-400" size={20} />
                <span>Nairobi, Kenya · Remote worldwide</span>
              </li>
            </ul>
          </div>

          <motion.form
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={onSubmit}
            className="rounded-2xl border border-white/10 bg-[#12121a] p-8"
          >
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-zinc-300">
                  Name
                </Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-white/10 bg-[#0a0a0f] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-white/10 bg-[#0a0a0f] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Service of Interest</Label>
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger className="border-white/10 bg-[#0a0a0f] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#12121a] text-zinc-100">
                    {CONTACT_SERVICES.map((s) => (
                      <SelectItem key={s} value={s} className="text-zinc-100 focus:bg-orange-500/20 focus:text-white">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message" className="text-zinc-300">
                  Message
                </Label>
                <Textarea
                  id="message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="border-white/10 bg-[#0a0a0f] text-white"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-teal-500 py-3.5 text-sm font-semibold text-black transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                <Send size={18} />
                Send message
              </button>
            </div>
          </motion.form>
        </div>
      </section>
    </TechMediaLayout>
  );
}
