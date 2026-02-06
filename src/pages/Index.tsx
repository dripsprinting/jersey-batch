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
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              src="/favicon.png"
              alt="Drips Printing Logo"
              className="h-24 w-24 mx-auto mb-8 rounded-full shadow-2xl border-4 border-white object-cover bg-white p-1"
            />
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              Drips Printing
            </h1>
            <p className="text-xl text-muted-foreground mb-12 max-w-xl mx-auto">
              The professional choice for custom apparel and premium customer solutions.
            </p>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center"
            >
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={() => navigate("/auth?type=reseller")}
                  className="flex items-center gap-2 px-8 py-4 rounded-full bg-white border-2 border-primary/20 text-primary font-bold hover:bg-primary/5 transition-all active:scale-95 shadow-sm"
                >
                  <UserCircle className="h-5 w-5" />
                  <span>Reseller Portal</span>
                </button>

                <button 
                  onClick={() => navigate("/auth?type=admin")}
                  className="flex items-center gap-2 px-8 py-4 rounded-full bg-muted/50 text-muted-foreground font-bold hover:bg-muted transition-all active:scale-95"
                >
                  <ShieldCheck className="h-5 w-5" />
                  <span>Admin</span>
                </button>
              </div>
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
