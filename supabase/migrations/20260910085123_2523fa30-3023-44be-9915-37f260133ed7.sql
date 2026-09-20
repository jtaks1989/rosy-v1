INSERT INTO public.role_permissions (role_preset, permission)
VALUES ('leadership', 'view_people_documents')
ON CONFLICT DO NOTHING;