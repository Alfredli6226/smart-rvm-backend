-- Sample Advertisement Data
-- Run this after creating the advertisements table

INSERT INTO advertisements (title, media_url, media_type, duration, assigned_machines, contact_number, status, created_by) VALUES
(
  'Recycle Rewards Campaign',
  'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=400',
  'image',
  NULL,
  ARRAY[1, 2, 3],
  '+60123456789',
  'active',
  1
),
(
  'Eco-Friendly Promo',
  'https://images.unsplash.com/photo-1532996122724-3c7597a9c410?w=400',
  'image',
  NULL,
  ARRAY[4, 5],
  '+60198765432',
  'active',
  1
),
(
  'Green Machine Demo',
  'https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=400',
  'image',
  NULL,
  ARRAY[1],
  '+601155577999',
  'inactive',
  1
),
(
  'Sustainability Video',
  'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
  'video',
  15,
  ARRAY[2, 3, 4, 5],
  '+60112233445',
  'active',
  1
)
ON CONFLICT DO NOTHING;