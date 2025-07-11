-- Seed data for testing purposes

-- Insert admin and regular users
INSERT INTO users (id, email, role, full_name, avatar_url)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@example.com', 'admin', 'Admin User', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'),
    ('00000000-0000-0000-0000-000000000002', 'user1@example.com', 'user', 'Regular User 1', 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1'),
    ('00000000-0000-0000-0000-000000000003', 'user2@example.com', 'user', 'Regular User 2', 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2');

-- Insert example proposals
INSERT INTO proposals (
    id, 
    title, 
    logo_url, 
    company_name, 
    campaign_start_date, 
    campaign_end_date, 
    short_description, 
    content, 
    created_by
)
VALUES
    (
        '00000000-0000-0000-0000-000000000010', 
        'New Product Launch Campaign', 
        'https://placekitten.com/200/200', 
        'Tech Innovations Inc.', 
        CURRENT_DATE, 
        CURRENT_DATE + INTERVAL '30 days', 
        'Help us promote our revolutionary new smart device to your audience.', 
        '{"blocks":[{"type":"paragraph","text":"We are launching a revolutionary new smart device that will change how people interact with technology."},{"type":"paragraph","text":"Looking for influencers to create authentic content showcasing the product features."},{"type":"heading","text":"Key Points to Cover","level":2},{"type":"list","items":["Ease of use","Integration with other devices","Battery life","Design features"]}]}', 
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        '00000000-0000-0000-0000-000000000011', 
        'Eco-Friendly Brand Awareness', 
        'https://placekitten.com/201/201', 
        'Green Earth Products', 
        CURRENT_DATE - INTERVAL '5 days', 
        CURRENT_DATE + INTERVAL '25 days', 
        'Spread awareness about our sustainable products and eco-friendly initiatives.', 
        '{"blocks":[{"type":"paragraph","text":"Our company is dedicated to producing 100% sustainable products with zero waste."},{"type":"paragraph","text":"We are seeking content creators who are passionate about environmental issues."},{"type":"heading","text":"Campaign Goals","level":2},{"type":"list","items":["Highlight our plastic-free packaging","Showcase our carbon-neutral manufacturing process","Demonstrate product durability and quality","Explain our recycling program"]}]}', 
        '00000000-0000-0000-0000-000000000001'
    );

-- Insert example responses
INSERT INTO responses (
    id,
    proposal_id,
    user_id,
    status,
    quote,
    proposed_publish_date,
    platforms,
    video_link,
    payment_method,
    message
)
VALUES
    (
        '00000000-0000-0000-0000-000000000020',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000002',
        'accepted',
        'Technology that empowers is technology that endures.',
        CURRENT_DATE + INTERVAL '10 days',
        ARRAY['YouTube', 'Instagram', 'TikTok'],
        'https://www.youtube.com/watch?v=example1',
        'PayPal',
        'I would love to create a detailed review video highlighting all the features of your smart device. My audience is very tech-savvy and would be interested in this product.'
    ),
    (
        '00000000-0000-0000-0000-000000000021',
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000003',
        'accepted',
        'Small changes, when multiplied by millions, can transform the world.',
        CURRENT_DATE + INTERVAL '15 days',
        ARRAY['Instagram', 'YouTube'],
        NULL,
        'Wire Transfer',
        'As someone passionate about environmental causes, I would be thrilled to feature your eco-friendly products. I can create a series of Instagram posts and a YouTube video showing your products in use.'
    );

-- Insert example admin responses
INSERT INTO admin_responses (
    id,
    response_id,
    status,
    message_to_user
)
VALUES
    (
        '00000000-0000-0000-0000-000000000030',
        '00000000-0000-0000-0000-000000000020',
        'approved',
        'Thank you for your interest in our product! We love your quote and are excited to see your review. Please focus on the integration capabilities with other smart home devices.'
    ),
    (
        '00000000-0000-0000-0000-000000000031',
        '00000000-0000-0000-0000-000000000021',
        'pending',
        'Thank you for your proposal. We are currently reviewing it and will get back to you shortly with more details about our products.'
    ); 