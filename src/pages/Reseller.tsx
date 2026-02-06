import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, LogOut, Filter, RefreshCw, 
  Package, Clock, Truck, CheckCircle2, Phone, Facebook,
  LayoutDashboard, Receipt, ChevronRight, Plus, User
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@supabase/supabase-js";

interface OrderWithCustomer {
  id: string;
  player_name_front: string | null;
  player_name_back: string;
  jersey_number: string;
  product_type: string;
  size: string;
  style: string;
  status: string;
  created_at: string;
  customers: {
    team_name: string;
    fb_link: string | null;
    contact_phone: string | null;
    design_url: string | null;
    reseller_id: string | null;
  } | null;
}

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, color: "status-pending" },
  in_production: { label: "In Production", icon: Package, color: "status-in_production" },
  shipped: { label: "Shipped", icon: Truck, color: "status-shipped" },
  completed: { label: "Completed", icon: CheckCircle2, color: "status-completed" },
};

export default function Reseller() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"orders" | "transactions">("orders");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/auth");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchOrders = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          player_name_front,
          player_name_back,
          jersey_number,
          product_type,
          size,
          style,
          status,
          created_at,
          customers!inner (
            team_name,
            fb_link,
            contact_phone,
            design_url,
            reseller_id
          )
        `)
        .eq("customers.reseller_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data as any) || []);
    } catch (error: any) {
      console.error("Error fetching orders detail:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load your orders",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  const uniqueTeams = useMemo(() => {
    const teams = new Set<string>();
    orders.forEach((o) => {
      if (o.customers?.team_name) teams.add(o.customers.team_name);
    });
    return Array.from(teams).sort();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        searchQuery === "" ||
        order.player_name_back?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customers?.team_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesTeam = teamFilter === "all" || order.customers?.team_name === teamFilter;

      return matchesSearch && matchesStatus && matchesTeam;
    });
  }, [orders, searchQuery, statusFilter, teamFilter]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const SidebarItem = ({ id, label, icon: Icon }: { id: any, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
        activeTab === id 
          ? "bg-primary text-primary-foreground shadow-md" 
          : "text-muted-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="font-medium">{label}</span>
      {activeTab === id && <ChevronRight className="ml-auto h-4 w-4" />}
    </button>
  );

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-muted/30 text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-background flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b">
          <img 
            src="/favicon.png" 
            alt="Logo" 
            className="h-8 w-8 rounded-lg object-cover bg-white"
          />
          <span className="font-bold text-lg tracking-tight">Reseller Portal</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem id="orders" label="My Orders" icon={LayoutDashboard} />
          <SidebarItem id="transactions" label="Balance" icon={Receipt} />
          <Button 
            className="w-full mt-4 flex items-center gap-2" 
            onClick={() => navigate("/order")}
          >
            <Plus className="h-4 w-4" /> New Order
          </Button>
        </nav>

        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={handleLogout}>
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-background flex items-center justify-between px-6 shrink-0">
          <h2 className="text-xl font-semibold capitalize">{activeTab}</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{user.email}</span>
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary">
              {user.email?.[0].toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === "orders" ? (
              <motion.div
                key="orders"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="border-none shadow-md">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <CardTitle>My Submissions</CardTitle>
                        <CardDescription>View status of your customer orders</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={fetchOrders}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search orders..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-48">
                          <Filter className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          {Object.keys(STATUS_CONFIG).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={teamFilter} onValueChange={setTeamFilter}>
                        <SelectTrigger className="w-full sm:w-64">
                          <User className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="All Customers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Customers</SelectItem>
                          {uniqueTeams.map((team) => (
                            <SelectItem key={team} value={team}>
                              {team}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Customer</TableHead>
                            <TableHead>Player</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-12">
                                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
                              </TableCell>
                            </TableRow>
                          ) : filteredOrders.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                No orders found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredOrders.map((order) => {
                              const config = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
                              return (
                                <TableRow key={order.id}>
                                  <TableCell className="font-bold">{order.customers?.team_name}</TableCell>
                                  <TableCell>{order.player_name_back} (#{order.jersey_number})</TableCell>
                                  <TableCell className="text-sm">{order.product_type}</TableCell>
                                  <TableCell>
                                    <Badge className={`${config?.color || "bg-gray-500"} text-white border-none`}>
                                      {config?.label || order.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">
                                    {new Date(order.created_at).toLocaleDateString()}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="balance"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col items-center justify-center h-[60vh] text-center"
              >
                <div className="p-6 rounded-full bg-primary/10 mb-4">
                  <Receipt className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Reseller Credit</h3>
                <p className="text-muted-foreground max-w-sm mt-2">
                  Your credit balance and commission history will appear here once your account is verified.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
