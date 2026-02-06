import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { CustomerInfo } from "@/components/CustomerInfo";
import { OrderForm, type JerseyItem } from "@/components/OrderForm";
import { BatchCart } from "@/components/BatchCart";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const Order = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [teamName, setTeamName] = useState("");
  const [fbLink, setFbLink] = useState("");
  const [phone, setPhone] = useState("");
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [jerseys, setJerseys] = useState<JerseyItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAddJersey = (jersey: Omit<JerseyItem, "id" | "customerName" | "customerFb" | "customerPhone">) => {
    if (!teamName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a team or customer name above first",
        variant: "destructive",
      });
      return;
    }

    const newJersey: JerseyItem = {
      ...jersey,
      id: uuidv4(),
      customerName: teamName.trim(),
      customerFb: fbLink.trim() || undefined,
      customerPhone: phone.trim() || undefined,
      customerDesign: designFile || undefined,
    };
    setJerseys((prev) => [...prev, newJersey]);
    toast({
      title: "Item Added",
      description: `${jersey.product} for ${jersey.playerNameBack} added to batch`,
    });
  };

  const handleAddJerseys = (newJerseys: Omit<JerseyItem, "id" | "customerName" | "customerFb" | "customerPhone">[]) => {
    if (!teamName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a team or customer name above first",
        variant: "destructive",
      });
      return;
    }

    const processedJerseys = newJerseys.map(jersey => ({
      ...jersey,
      id: uuidv4(),
      customerName: teamName.trim(),
      customerFb: fbLink.trim() || undefined,
      customerPhone: phone.trim() || undefined,
      customerDesign: designFile || undefined,
    }));

    setJerseys((prev) => [...prev, ...processedJerseys]);
    toast({
      title: "Bulk Add Complete",
      description: `Successfully added ${newJerseys.length} items to batch`,
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
        title: "No Items",
        description: "Please add at least one item to your batch",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Group items by unique customer details
      const customerBatches = new Map<string, { 
        name: string, 
        fb: string, 
        phone: string, 
        design: File | null,
        items: JerseyItem[] 
      }>();

      jerseys.forEach((j) => {
        const key = `${j.customerName}-${j.customerFb}-${j.customerPhone}`;
        if (!customerBatches.has(key)) {
          customerBatches.set(key, {
            name: j.customerName,
            fb: j.customerFb || "",
            phone: j.customerPhone || "",
            design: j.customerDesign || null,
            items: [],
          });
        }
        customerBatches.get(key)!.items.push(j);
      });

      // Submit each batch
      for (const [_, customerData] of Array.from(customerBatches)) {
        let designUrl = null;

        // Upload design if exists
        if (customerData.design) {
          const fileExt = customerData.design.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('designs')
            .upload(fileName, customerData.design);

          if (uploadError) throw uploadError;
          designUrl = fileName;
        }

        // Create or find customer (for simplicity we create a new entry per batch)
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .insert({
            team_name: customerData.name,
            fb_link: customerData.fb,
            contact_phone: customerData.phone,
            design_url: designUrl,
            reseller_id: user?.id || null,
          })
          .select()
          .single();

        if (customerError) throw customerError;

        // Create orders for this specific customer
        const orders = customerData.items.map((item) => ({
          customer_id: customer.id,
          player_name: item.playerNameBack || item.playerNameFront || "",
          player_name_front: item.playerNameFront,
          player_name_back: item.playerNameBack,
          jersey_number: item.jerseyNumber,
          size: item.size as any,
          style: item.style as any,
          product_type: item.product,
          status: "pending" as const,
        }));

        const { error: ordersError } = await supabase.from("orders").insert(orders);
        if (ordersError) throw ordersError;
      }

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

  const handleClearCustomer = () => {
    setTeamName("");
    setFbLink("");
    setPhone("");
    setDesignFile(null);
    toast({
      title: "Form Cleared",
      description: "You can now enter details for another person",
    });
  };

  const handleNewOrder = () => {
    setTeamName("");
    setFbLink("");
    setPhone("");
    setDesignFile(null);
    setJerseys([]);
    setShowConfirmation(false);
    setSubmittedCount(0);
  };

  if (showConfirmation) {
    return (
      <OrderConfirmation 
        orderCount={submittedCount} 
        teamName={teamName || "Your Team"}
        onNewOrder={handleNewOrder} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 to-background py-12 lg:py-16">
        <div className="container px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto"
          >
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              Drips Printing <span className="text-gradient">Orders</span>
            </h1>
            <p className="text-lg text-muted-foreground italic">
              Custom apparel and team wear solutions.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container px-4 sm:px-6 py-8 lg:py-12">
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
                fbLink={fbLink}
                phone={phone}
                designFile={designFile}
                onTeamNameChange={setTeamName}
                onFbLinkChange={setFbLink}
                onPhoneChange={setPhone}
                onDesignFileChange={setDesignFile}
                onClear={handleClearCustomer}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <OrderForm 
                onAddJersey={handleAddJersey} 
                onAddJerseys={handleAddJerseys}
              />
            </motion.div>
          </div>

          {/* Right Column - Cart */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="sticky top-24"
            >
              <BatchCart 
                items={jerseys} 
                onRemoveItem={handleRemoveJersey}
                onSubmit={handleSubmitOrder}
                isSubmitting={isSubmitting}
              />
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Order;
