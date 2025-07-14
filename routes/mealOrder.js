import { Router } from "express";
import {
    placeOrder, getMyOrders, cancelOrder, getChefOrders, updateOrderStatus } from "../controllers/mealOrders.js";
import { isAuthenticated, hasPermission } from "../middlewares/auth.js";

const orderRouter = Router();

// Place a new order
orderRouter.post( "/orders", isAuthenticated, hasPermission("place_orders"), placeOrder);

// View my orders
orderRouter.get( "/orders/my", isAuthenticated, hasPermission("view_order_history"), getMyOrders);

// Cancel a pending order
orderRouter.patch( "/orders/:orderId/cancel", isAuthenticated, hasPermission("cancel_order"), cancelOrder);

// POTCHEF -View orders for my meals
orderRouter.get(
    "/chef/orders",
    isAuthenticated,
    hasPermission("view_incoming_orders"),
    getChefOrders
);

// Accept / Reject / Mark Delivered
orderRouter.patch(
    "/chef/orders/:orderId/status",
    isAuthenticated,
    hasPermission("update_order_status"),
    updateOrderStatus
);


export default orderRouter;
