import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { logger } from "@/lib/logger";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Download, LogOut, Filter, RefreshCw, 
  Package, Clock, Truck, CheckCircle2, Phone, Facebook
} from "lucide-react";
import { motion } from "framer-motion";

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
            design_url
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rawOrders = (data as unknown as OrderWithCustomer[]) || [];
      const ordersWithUrls = await generateSignedUrls(rawOrders);
      setOrders(ordersWithUrls);
    } catch (error) {
      logger.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: "Failed to load orders",
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

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus as "pending" | "in_production" | "shipped" | "completed" })
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

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {[
            { label: "Total Orders", value: stats.total, icon: Package, color: "text-foreground" },
            { label: "Pending", value: stats.pending, icon: Clock, color: "text-warning" },
            { label: "In Production", value: stats.inProduction, icon: Package, color: "text-primary" },
            { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-success" },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                    <stat.icon className={`h-8 w-8 ${stat.color} opacity-50`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Order Management</CardTitle>
                <CardDescription>View and manage all jersey orders</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={fetchOrders}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="ghost" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
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
                  placeholder="Search by team, player, or number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_CONFIG[status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead className="text-center">Design</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Number</TableHead>
                    <TableHead className="text-center">Size</TableHead>
                    <TableHead className="text-center">Style</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                        No orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => {
                      const statusConfig = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
                      const designUrl = order._designSignedUrl;
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.customers?.team_name || "Unknown"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-xs gap-1">
                              {order.customers?.contact_phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {order.customers.contact_phone}
                                </span>
                              )}
                              {order.customers?.fb_link && (
                                <span className="flex items-center gap-1 text-primary">
                                  <Facebook className="h-3 w-3" /> {order.customers.fb_link}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {designUrl ? (
                              <a 
                                href={designUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-block"
                              >
                                <div className="h-10 w-10 rounded overflow-hidden border bg-muted flex items-center justify-center hover:opacity-80 transition-opacity">
                                  <img 
                                    src={designUrl} 
                                    alt="Design" 
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">No design</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold">{order.player_name_back}</span>
                              {order.player_name_front && (
                                <span className="text-xs text-muted-foreground italic">
                                  Front: {order.player_name_front}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{order.product_type}</TableCell>
                          <TableCell className="text-center font-mono font-bold">
                            {order.jersey_number}
                          </TableCell>
                          <TableCell className="text-center">{order.size}</TableCell>
                          <TableCell className="text-center capitalize">{order.style}</TableCell>
                          <TableCell>
                            <Badge className={`status-badge ${statusConfig?.color || ""}`}>
                              {statusConfig?.label || order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={order.status}
                              onValueChange={(value) => updateOrderStatus(order.id, value)}
                            >
                              <SelectTrigger className="w-36 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((status) => (
                                  <SelectItem key={status} value={status}>
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
      </main>
    </div>
  );
}
