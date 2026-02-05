import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Header } from "@/components/Header";
import { CustomerInfo } from "@/components/CustomerInfo";
import { OrderForm, type JerseyItem } from "@/components/OrderForm";
import { BatchCart } from "@/components/BatchCart";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Shirt } from "lucide-react";

const Index = () => {
  const { toast } = useToast();
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jerseys, setJerseys] = useState<JerseyItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);

  const handleAddJersey = (jersey: Omit<JerseyItem, "id">) => {
    const newJersey: JerseyItem = {
      ...jersey,
      id: uuidv4(),
    };
    setJerseys((prev) => [...prev, newJersey]);
    toast({
      title: "Jersey Added",
      description: `${jersey.playerName} #${jersey.jerseyNumber} added to batch`,
    });
  };

  const handleRemoveJersey = (id: string) => {
    setJerseys((prev) => prev.filter((j) => j.id !== id));
  };

  const handleSubmitOrder = async () => {
    if (!teamName.trim()) {
      toast({
        title: "Team Name Required",
        description: "Please enter a team or customer name",
        variant: "destructive",
      });
      return;
    }

    if (jerseys.length === 0) {
      toast({
        title: "No Jerseys",
        description: "Please add at least one jersey to your order",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create customer
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          team_name: teamName.trim(),
          contact_email: email.trim() || null,
          contact_phone: phone.trim() || null,
        })
        .select()
        .single();

      if (customerError) throw customerError;

      // Create all orders
      const orders = jerseys.map((jersey) => ({
        customer_id: customer.id,
        player_name: jersey.playerName,
        jersey_number: jersey.jerseyNumber,
        size: jersey.size as "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL",
        style: jersey.style as "home" | "away",
        status: "pending" as const,
      }));

      const { error: ordersError } = await supabase.from("orders").insert(orders);

      if (ordersError) throw ordersError;

      setSubmittedCount(jerseys.length);
      setShowConfirmation(true);
    } catch (error) {
      console.error("Order submission error:", error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewOrder = () => {
    setTeamName("");
    setEmail("");
    setPhone("");
    setJerseys([]);
    setShowConfirmation(false);
    setSubmittedCount(0);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 to-background py-12 lg:py-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center justify-center p-2 mb-4 rounded-full bg-primary/10">
              <Shirt className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              Bulk Jersey <span className="text-gradient">Orders</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Create professional custom jerseys for your team. Add multiple players to a single order
              and see live previews as you build your batch.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container py-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <CustomerInfo
                teamName={teamName}
                email={email}
                phone={phone}
                onTeamNameChange={setTeamName}
                onEmailChange={setEmail}
                onPhoneChange={setPhone}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <OrderForm onAddJersey={handleAddJersey} />
            </motion.div>
          </div>

          {/* Right Column - Cart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <BatchCart
              items={jerseys}
              onRemoveItem={handleRemoveJersey}
              onSubmit={handleSubmitOrder}
              isSubmitting={isSubmitting}
            />
          </motion.div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <OrderConfirmation
          orderCount={submittedCount}
          teamName={teamName}
          onNewOrder={handleNewOrder}
        />
      )}
    </div>
  );
};

export default Index;
