import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

const GlassCard = ({ children, className, hover = true }: GlassCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    whileHover={hover ? { y: -4, scale: 1.01 } : undefined}
    className={cn("glass rounded-xl p-6", className)}
  >
    {children}
  </motion.div>
);

export default GlassCard;
