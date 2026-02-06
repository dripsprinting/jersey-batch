import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Download, LogOut, Filter, RefreshCw, 
  Package, Clock, Truck, CheckCircle2, Phone, Facebook,
  LayoutDashboard, Receipt, ChevronRight, Menu, CheckSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    reseller?: {
      email: string;
      role: string;
    } | null;
  } | null;
  _designSignedUrl?: string | null;
}

const STATUS_OPTIONS = ["pending", "in_production", "shipped", "completed"] as const;

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, color: "status-pending" },
  in_production: { label: "In Production", icon: Package, color: "status-in_production" },
  shipped: { label: "Shipped", icon: Truck, color: "status-shipped" },
  completed: { label: "Completed", icon: CheckCircle2, color: "status-completed" },
};

/**
 * Extracts the storage file path from a design URL.
 * Handles both full public URLs and plain file paths.
 */
function extractFilePath(designUrl: string): string {
  // If it's a full Supabase storage URL, extract the path after /designs/
  const match = designUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/designs\/(.+)/);
  if (match) return match[1];
  // Otherwise assume it's already a file path
  return designUrl;
}

export default function Admin() {
  const { user, isAdmin, isLoading: authLoading } = useAdminAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"orders" | "transactions" | "confirmations">("orders");
  const isSidebarOpen = true; // Changed to constant as toggle logic wasn't fully utilized

  const generateSignedUrls = useCallback(async (ordersData: OrderWithCustomer[]) => {
    const updated = await Promise.all(
      ordersData.map(async (order) => {
        if (!order.customers?.design_url) return order;
        try {
          const filePath = extractFilePath(order.customers.design_url);
          const { data, error } = await supabase.storage
            .from("designs")
            .createSignedUrl(filePath, 3600); // 1 hour expiry
          if (error) throw error;
          return { ...order, _designSignedUrl: data.signedUrl };
        } catch {
          return { ...order, _designSignedUrl: null };
        }
      })
    );
    return updated;
  }, []);

  const fetchOrders = useCallback(async () => {
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
          customers (
            team_name,
            fb_link,
            contact_phone,
            design_url,
            reseller:profiles (
              email,
              role
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rawOrders = (data as unknown as OrderWithCustomer[]) || [];
      const ordersWithUrls = await generateSignedUrls(rawOrders);
      setOrders(ordersWithUrls);
    } catch (error: any) {
      logger.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [generateSignedUrls, toast]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchOrders();
    }
  }, [user, isAdmin, fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        searchQuery === "" ||
        order.player_name_back?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.player_name_front?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.jersey_number.includes(searchQuery) ||
        order.customers?.team_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesTeam = teamFilter === "all" || order.customers?.team_name === teamFilter;

      return matchesSearch && matchesStatus && matchesTeam;
    });
  }, [orders, searchQuery, statusFilter, teamFilter]);

  const uniqueTeams = useMemo(() => {
    const teams = orders
      .map((o) => o.customers?.team_name)
      .filter((name): name is string => !!name);
    return Array.from(new Set(teams)).sort();
  }, [orders]);

  const pendingBatches = useMemo(() => {
    const map = new Map<string, {
      teamName: string,
      customer: any,
      orders: OrderWithCustomer[],
      pendingCount: number
    }>();

    orders.forEach(order => {
      const team = order.customers?.team_name || "Unknown";
      if (!map.has(team)) {
        map.set(team, { 
          teamName: team, 
          customer: order.customers, 
          orders: [], 
          pendingCount: 0 
        });
      }
      const data = map.get(team)!;
      data.orders.push(order);
      if (order.status === "pending") {
        data.pendingCount++;
      }
    });

    return Array.from(map.values())
      .filter(b => b.pendingCount > 0)
      .sort((a, b) => b.pendingCount - a.pendingCount);
  }, [orders]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus as any })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      toast({
        title: "Status Updated",
        description: `Order status changed to ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label || newStatus}`,
      });
    } catch (error) {
      logger.error("Error updating status:", error);
      toast({
        title: "Update Failed",
        description: "Could not update order status",
        variant: "destructive",
      });
    }
  };

  const confirmBatch = async (batchOrders: OrderWithCustomer[]) => {
    try {
      const pendingIds = batchOrders
        .filter(o => o.status === "pending")
        .map(o => o.id);

      if (pendingIds.length === 0) return;

      const { error } = await supabase
        .from("orders")
        .update({ status: "in_production" })
        .in("id", pendingIds);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          pendingIds.includes(order.id) ? { ...order, status: "in_production" } : order
        )
      );

      toast({
        title: "Batch Confirmed",
        description: `Successfully moved ${pendingIds.length} orders to In Production`,
      });
    } catch (error) {
      console.error("Batch confirmation error:", error);
      toast({
        title: "Confirmation Failed",
        description: "Could not confirm the batch",
        variant: "destructive",
      });
    }
  };

  const confirmAllPending = async () => {
    try {
      const allPendingIds = orders
        .filter(o => o.status === "pending")
        .map(o => o.id);

      if (allPendingIds.length === 0) {
        toast({ title: "No pending orders", description: "All orders are already confirmed or processed." });
        return;
      }

      const { error } = await supabase
        .from("orders")
        .update({ status: "in_production" })
        .in("id", allPendingIds);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          allPendingIds.includes(order.id) ? { ...order, status: "in_production" } : order
        )
      );

      toast({
        title: "All Orders Confirmed",
        description: `Successfully moved ${allPendingIds.length} orders to In Production`,
      });
    } catch (error) {
      console.error("Critical: Confirm all error:", error);
      toast({
        title: "Error",
        description: "Failed to confirm all pending orders",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    const headers = ["Team Name", "Name (Front)", "Name (Back)", "Number", "Size", "Style", "Status", "Date"];
    const rows = filteredOrders.map((order) => [
      order.customers?.team_name || "",
      order.player_name_front || "",
      order.player_name_back,
      order.jersey_number,
      order.size,
      order.style,
      order.status,
      new Date(order.created_at).toLocaleDateString(),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `jersey-orders-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast({
      title: "Export Complete",
      description: `Exported ${filteredOrders.length} orders to CSV`,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      inProduction: orders.filter((o) => o.status === "in_production").length,
      completed: orders.filter((o) => o.status === "completed").length,
    };
  }, [orders]);

  // Show nothing while checking auth/admin role
  if (authLoading || !user || !isAdmin) {
    return null;
  }

  const SidebarItem = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
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

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? "w-64" : "w-20"
        } transition-all duration-300 border-r bg-background flex flex-col hidden md:flex`}
      >
        <div className="p-6 flex items-center gap-3 border-b">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          {isSidebarOpen && <span className="font-bold text-lg tracking-tight">Admin Pane</span>}
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem id="orders" label="Dashboard" icon={LayoutDashboard} />
          <SidebarItem id="confirmations" label="Confirmations" icon={CheckSquare} />
          <SidebarItem id="transactions" label="Transactions" icon={Receipt} />
        </nav>

        <div className="p-4 border-t space-y-2">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={handleLogout}>
            <LogOut className="mr-3 h-5 w-5" />
            {isSidebarOpen && "Logout"}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b bg-background flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-semibold capitalize">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{user?.email}</span>
            <div className="h-8 w-8 rounded-full bg-muted border flex items-center justify-center font-bold text-primary">
              {user?.email?.[0].toUpperCase()}
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
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    { label: "Total Orders", value: stats.total, icon: Package, color: "text-foreground" },
                    { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-500" },
                    { label: "In Production", value: stats.inProduction, icon: Package, color: "text-blue-500" },
                    { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-green-500" },
                  ].map((stat) => (
                    <Card key={stat.label}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                          </div>
                          <div className={`p-3 rounded-xl bg-muted ${stat.color}`}>
                            <stat.icon className="h-6 w-6" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Orders Content */}
                <Card className="border-none shadow-md overflow-hidden">
                  <CardHeader className="bg-background">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <CardTitle>Orders List</CardTitle>
                        <CardDescription>Real-time order tracking and management</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={fetchOrders}>
                          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                          Sync
                        </Button>
                        <Button variant="default" size="sm" onClick={exportToCSV}>
                          <Download className="mr-2 h-4 w-4" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Team name, player, or #number..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <Select value={teamFilter} onValueChange={setTeamFilter}>
                          <SelectTrigger className="w-full sm:w-48">
                            <Package className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Team/Customer" />
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

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-full sm:w-48">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Items</SelectItem>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {STATUS_CONFIG[status].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="rounded-lg border bg-background overflow-hidden overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-[200px]">Customer / Team</TableHead>
                            <TableHead className="text-center">Design</TableHead>
                            <TableHead>Player Details</TableHead>
                            <TableHead>Jersey Info</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-24">
                                <div className="flex flex-col items-center gap-2">
                                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                                  <p className="text-sm text-muted-foreground font-medium">Loading orders...</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : filteredOrders.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-24 text-muted-foreground">
                                <div className="flex flex-col items-center gap-2">
                                  <Package className="h-12 w-12 opacity-20" />
                                  <p className="text-lg font-medium">No results found</p>
                                  <p className="text-sm">Try adjusting your filters or search query.</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredOrders.map((order) => {
                              const statusConfig = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
                              const designUrl = order._designSignedUrl;
                              return (
                                <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="font-bold text-foreground truncate">{order.customers?.team_name || "Unknown Team"}</p>
                                      {order.customers?.reseller && (
                                        <Badge variant="outline" className="text-[10px] py-0 h-4 bg-primary/5 text-primary border-primary/20">
                                          Reseller: {order.customers.reseller.email.split('@')[0]}
                                        </Badge>
                                      )}
                                      <div className="flex flex-col text-[11px] text-muted-foreground mt-1">
                                        {order.customers?.contact_phone && (
                                          <span className="flex items-center gap-1">
                                            <Phone className="h-3 w-3" /> {order.customers.contact_phone}
                                          </span>
                                        )}
                                        {order.customers?.fb_link && (
                                          <a 
                                            href={order.customers.fb_link} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-primary hover:underline"
                                          >
                                            <Facebook className="h-3 w-3" /> Profile Link
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {designUrl ? (
                                      <a 
                                        href={designUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-block group"
                                      >
                                        <div className="h-12 w-12 rounded-lg overflow-hidden border-2 border-muted bg-white flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-primary shadow-sm">
                                          <img 
                                            src={designUrl} 
                                            alt="Design" 
                                            className="h-full w-full object-cover"
                                          />
                                        </div>
                                      </a>
                                    ) : (
                                      <div className="h-12 w-12 rounded-lg border border-dashed flex items-center justify-center text-[10px] text-muted-foreground text-center bg-muted/20">
                                        N/A
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-bold text-primary">{order.player_name_back}</span>
                                      {order.player_name_front && (
                                        <span className="text-[11px] font-medium text-muted-foreground bg-muted w-fit px-1.5 rounded">
                                          Front: {order.player_name_front}
                                        </span>
                                      )}
                                      <span className="text-xs mt-1 font-mono">#{order.jersey_number}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="text-xs font-semibold truncate max-w-[120px]">{order.product_type}</p>
                                      <div className="flex gap-1">
                                        <Badge variant="outline" className="text-[10px] px-1 h-5">{order.size}</Badge>
                                        <Badge variant="outline" className="text-[10px] px-1 h-5 capitalize">{order.style}</Badge>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={`${statusConfig?.color || "bg-gray-500"} text-white border-none text-[11px]`}>
                                      {statusConfig?.label || order.status}
                                    </Badge>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      {new Date(order.created_at).toLocaleDateString()}
                                    </p>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Select
                                      value={order.status}
                                      onValueChange={(value) => updateOrderStatus(order.id, value)}
                                    >
                                      <SelectTrigger className="w-[120px] h-8 text-[11px] ml-auto">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {STATUS_OPTIONS.map((status) => (
                                          <SelectItem key={status} value={status} className="text-[11px]">
                                            {STATUS_CONFIG[status].label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
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
            ) : activeTab === "confirmations" ? (
              <motion.div
                key="confirmations"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-bold">Pending Confirmations</h3>
                    <p className="text-sm text-muted-foreground">New batches awaiting initial confirmation</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {pendingBatches.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 font-bold"
                        onClick={confirmAllPending}
                      >
                        <CheckSquare className="mr-2 h-4 w-4" />
                        Confirm All {orders.filter(o => o.status === "pending").length} Items
                      </Button>
                    )}
                    <Badge variant="secondary" className="px-3 py-1 text-sm font-bold">
                      {pendingBatches.length} Teams Waiting
                    </Badge>
                  </div>
                </div>

                {pendingBatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-background rounded-xl border border-dashed">
                    <CheckCircle2 className="h-12 w-12 text-success opacity-20 mb-4" />
                    <p className="text-lg font-medium">All caught up!</p>
                    <p className="text-sm text-muted-foreground">No new batches needing confirmation.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {pendingBatches.map((batch) => (
                      <Card key={batch.teamName} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col md:flex-row items-stretch">
                          {/* Left Strip - Design */}
                          <div className="w-full md:w-32 bg-muted/30 flex items-center justify-center p-4 border-r">
                            {batch.customer?.design_url ? (
                              <a href={batch.customer.design_url} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={batch.customer.design_url} 
                                  className="h-20 w-20 object-cover rounded-lg border shadow-sm"
                                  alt="Design"
                                />
                              </a>
                            ) : (
                              <div className="h-20 w-20 rounded-lg border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground bg-white">
                                No Design
                              </div>
                            )}
                          </div>

                          <div className="flex-1 p-6 flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3">
                                <h4 className="text-xl font-bold">{batch.teamName}</h4>
                                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">
                                  {batch.pendingCount} Pending Items
                                </Badge>
                                {batch.customer?.reseller && (
                                  <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20">
                                    Reseller: {batch.customer.reseller.email.split('@')[0]}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                {batch.customer?.contact_phone && (
                                  <span className="flex items-center gap-1.5">
                                    <Phone className="h-4 w-4" /> {batch.customer.contact_phone}
                                  </span>
                                )}
                                {batch.customer?.fb_link && (
                                  <span className="flex items-center gap-1.5">
                                    <Facebook className="h-4 w-4" /> Profile Attached
                                  </span>
                                )}
                                <span className="flex items-center gap-1.5">
                                  <Clock className="h-4 w-4" /> Submitted {new Date(batch.orders[0].created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="pt-2">
                                <div className="flex gap-1 flex-wrap">
                                  {batch.orders.slice(0, 5).map((o, i) => (
                                    <Badge key={o.id} variant="outline" className="text-[10px]">
                                      {o.player_name_back} (#{o.jersey_number})
                                    </Badge>
                                  ))}
                                  {batch.orders.length > 5 && (
                                    <span className="text-[10px] text-muted-foreground font-medium flex items-center px-2">
                                      + {batch.orders.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col justify-center gap-3 min-w-[150px]">
                              <Button 
                                className="w-full font-bold shadow-lg"
                                onClick={() => confirmBatch(batch.orders)}
                              >
                                <CheckSquare className="mr-2 h-4 w-4" />
                                Confirm Batch
                              </Button>
                              <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={() => {
                                  setTeamFilter(batch.teamName);
                                  setActiveTab("orders");
                                }}
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="transactions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center justify-center h-[60vh] text-center"
              >
                <div className="p-6 rounded-full bg-muted mb-4">
                  <Receipt className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold">Transaction History</h3>
                <p className="text-muted-foreground max-w-sm mt-2">
                  This feature is coming soon. You'll be able to see payment records and deposit slips here.
                </p>
                <Button className="mt-6" onClick={() => setActiveTab("orders")}>
                  Return to Dashboard
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
