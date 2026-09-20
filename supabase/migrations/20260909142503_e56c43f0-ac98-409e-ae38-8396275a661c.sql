CREATE TABLE public.guest_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_label text NOT NULL DEFAULT 'Demo review adapter',
  external_id text,
  review_date date NOT NULL,
  author_alias text,
  rating numeric,
  rating_scale numeric NOT NULL DEFAULT 5,
  title text,
  body text,
  sentiment text NOT NULL DEFAULT 'neutral',
  topics text[] NOT NULL DEFAULT '{}',
  is_complaint boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new',
  responded_at timestamptz,
  response_note text,
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_reviews TO authenticated;
GRANT ALL ON public.guest_reviews TO service_role;

ALTER TABLE public.guest_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoped guest reviews" ON public.guest_reviews
FOR SELECT TO authenticated
USING (has_permission('view_guests') AND has_location_access(location_id));

CREATE INDEX guest_reviews_loc_date_idx ON public.guest_reviews (location_id, review_date DESC);

CREATE TRIGGER update_guest_reviews_updated_at BEFORE UPDATE ON public.guest_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.guest_reviews (org_id, location_id, source, external_id, review_date, author_alias, rating, title, body, sentiment, topics, is_complaint, status, responded_at, response_note) VALUES
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000032','google','demo-g-1001','2026-09-06','A. Farouk',5,'Best brunch in Barsha','Service was quick and the eggs were perfect. Will bring friends next weekend.','positive','{service,food}',false,'acknowledged','2026-09-07 08:00+04','Thanked the guest publicly.'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000032','google','demo-g-1002','2026-09-04','M. Haddad',2,'Waited 35 minutes for a table','We had a booking at 8pm and still waited over half an hour. Food was good once it arrived.','negative','{wait_time,reservations}',true,'in_progress',NULL,NULL),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000032','tripadvisor','demo-t-2001','2026-08-29','SarahJ_Dubai',4,'Lovely evening','Great atmosphere, slightly noisy near the bar but we enjoyed it.','positive','{ambience,noise}',false,'new',NULL,NULL),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000032','tripadvisor','demo-t-2002','2026-08-18','Traveller_88',1,'Order was wrong twice','Asked for no chilli, received a spicy dish twice. Staff apologised but the evening was spoiled.','negative','{order_accuracy,service}',true,'resolved','2026-08-19 12:30+04','Manager called the guest and offered a return visit.'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000031','google','demo-g-1003','2026-09-07','L. Chen',5,'Great view of the lake','Friendly team, food arrived hot. The truffle pasta is a must.','positive','{food,service}',false,'new',NULL,NULL),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000031','google','demo-g-1004','2026-09-01','R. Kapoor',3,'Good food, slow service','Two starters never arrived and we had to remind the team twice.','mixed','{service,wait_time}',true,'in_progress',NULL,NULL),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000031','tripadvisor','demo-t-2003','2026-08-24','JLTfoodie',4,'Reliable dinner spot','Consistent quality, prices are fair for the area.','positive','{value,food}',false,'acknowledged','2026-08-25 10:15+04','Replied thanking the guest.'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000031','tripadvisor','demo-t-2004','2026-07-30','GuestUAE',2,'Table was not ready','Booked through the app, arrived on time, seated 25 minutes late with no update.','negative','{reservations,wait_time}',true,'new',NULL,NULL),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000035','google','demo-g-1005','2026-09-05','N. Aziz',5,'Fast counter service','Perfect for a quick lunch at Time Out Market. Portions are generous.','positive','{service,value}',false,'new',NULL,NULL),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000035','google','demo-g-1006','2026-08-27','K. Osman',2,'Cold food at the counter','Picked up at the stall and the chicken was lukewarm. Told the staff, they replaced it.','negative','{food_temperature,food}',true,'resolved','2026-08-28 09:40+04','Kitchen hold times reviewed with the stall team.'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000035','tripadvisor','demo-t-2005','2026-08-12','MarketHopper',4,'Solid stall','Queue moves quickly, staff are cheerful.','positive','{service}',false,'acknowledged','2026-08-13 11:00+04','Shared with the stall team.'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000034','google','demo-g-1007','2026-09-03','D. Ferreira',5,'Beautiful room, brilliant cocktails','Booked for an anniversary and the team made it special.','positive','{ambience,service}',false,'acknowledged','2026-09-04 09:00+04','Thanked the guest and noted the occasion.'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000034','google','demo-g-1008','2026-08-21','H. Ali',2,'Overcharged on the bill','A drink we did not order appeared on the bill. It was removed but only after a long discussion.','negative','{billing,service}',true,'in_progress',NULL,NULL),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000034','tripadvisor','demo-t-2006','2026-08-08','FineDineFan',3,'Mixed experience','Food excellent, but the music was far too loud for conversation.','mixed','{noise,ambience}',true,'new',NULL,NULL),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000034','tripadvisor','demo-t-2007','2026-07-19','Nadia_R',5,'Worth the trip','One of the best dinners we have had this year in Dubai.','positive','{food}',false,'new',NULL,NULL),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000033','google','demo-g-1009','2026-09-08','Y. Mansour',5,'Cookies arrived warm','Delivery was fast and the box was intact. The brown butter cookie is unreal.','positive','{delivery,food}',false,'new',NULL,NULL),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000033','google','demo-g-1010','2026-08-31','S. Ibrahim',2,'Cookies crushed in delivery','Two of the six cookies arrived broken. Taste is great but the packaging needs work.','negative','{delivery,packaging}',true,'in_progress',NULL,NULL),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000033','google','demo-g-1011','2026-08-14','F. Noor',3,'Late delivery','Cookies were lovely but arrived 40 minutes after the promised time.','mixed','{delivery,wait_time}',true,'resolved','2026-08-15 10:00+04','Refunded the delivery fee.'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000033','tripadvisor','demo-t-2008','2026-07-25','CookieLover_UAE',5,'Only cookies, done properly','No menu clutter, just excellent cookies delivered to the door.','positive','{food,delivery}',false,'acknowledged','2026-07-26 09:30+04','Thanked the guest.');