import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { motion } from "framer-motion";
import { UserCircle, ShieldCheck, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-12 lg:py-16">
        <div className="container px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              Drips Printing
            </h1>
            <p className="text-xl text-muted-foreground italic mb-12 max-w-xl mx-auto">
              The professional choice for custom apparel and premium team wear solutions.
            </p>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap justify-center gap-6"
            >
              <button 
                onClick={() => navigate("/auth?type=reseller")}
                className="group flex items-center gap-4 px-10 py-4 rounded-full bg-white border-2 border-primary text-primary font-bold shadow-xl hover:bg-primary/5 transition-all hover:-translate-y-1 active:scale-95"
              >
                <UserCircle className="h-6 w-6" />
                <span className="text-lg">Reseller Portal</span>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
              </button>

              <button 
                onClick={() => navigate("/auth?type=admin")}
                className="group flex items-center gap-4 px-10 py-4 rounded-full bg-primary text-primary-foreground font-bold shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-1 active:scale-95"
              >
                <ShieldCheck className="h-6 w-6" />
                <span className="text-lg">Admin Panel</span>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <footer className="py-8 border-t bg-muted/20">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          © 2026 Drips Printing. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Index;
