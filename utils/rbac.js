export const permissions = [
    {
        role: 'potchef',
        actions: [
            'get_profile',
            'update_profile',
            'upload_meal',
            'update_meal',
            'view_all_meals',
            'view_my_meals',
            'delete_meal',
            'delete_meal',
            'update_meal_status',
            'view_orders',
            'view_incoming_orders',
            'update_order_status',
            'track_sales',
            'view_earnings',
            'bulk_upload_meals',
            'set_delivery_slots',
            'view_certification',
            'chat_with_operator',
            'view_order_history',
            'submit_certification',
            'receive_payment'
        ]
    },
    {
        role: 'potlucky',
        actions: [
            'get_profile',
            'update_profile',
            'view_all_meals',
            'place_orders',
            'view_order_history',
            'cancel_order',
            'browse_menu',
            'filter_menu',
            'place_order',
            'review_meal',
            'favorite_meal',
            'track_order',
            'leave_review',
            'favorite_meal',
            'view_order_history',
            'schedule_preorder',
            'cancel_order',
            'refer_friend',
            'redeem_loyalty_points'
        ]
    },
    {
        role: 'franchisee',
        actions: [
            'get_profile',
            'update_profile',
            'approve_meal_intake',
            'view_all_meals',
            'view_my_meals',
            'update_meal_status',
            'moderate_meal_status',
            'track_inventory',
            'view_sales_dashboard',
            'notify_potchefs',
            'generate_reports',
            'submit_feedback',
            'manage_in_store_promotions',
            'scan_meal_qr',
            'flag_rejected_meals'
        ]
    },
    {
        role: 'admin',
        actions: [
            'get_profile',
            'update_profile',
            'create_user',
            'view_all_meals',
            'view_my_meals',
            'update_meal_status',
            'moderate_meal_status',
            'delete_meal',
            'ban_user',
            'approve_users',
            'view_pending_users',
            'approve_potchef',
            'approve_operator',
            'manage_recipes',
            'send_announcement',
            'view_user_list',
            'access_user_metrics',
            'add_franchisee',
            'update_franchisee',
            'view_compliance_dashboard'
        ]
    },
    {
        role: 'super_agent',
        actions: [
            'get_profile',
            'update_profile',
            'create_user',
            'ban_user',
            'unban_user',
            'create_admin',
            'delete_admin',
            'approve_user_account',
            'view_all_analytics',
            'resolve_disputes',
            'manage_campaigns',
            'manage_promotions',
            'override_decisions',
            'modify_pricing',
            'access_audit_logs'
        ]
    },
    {
        role: 'territorial_manager',
        actions: [
            'get_profile',
            'update_profile',
            'view_region_orders',
            'view_region_inventory',
            'flag_irregular_activity',
            'send_regional_announcement',
            'monitor_potchefs',
            'recommend_user_approval',
            'view_territory_dashboard',
            'notify_super_agent'
        ]
    }
];
