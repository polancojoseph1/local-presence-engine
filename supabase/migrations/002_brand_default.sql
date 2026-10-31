-- New businesses start with the current blue identity. Existing custom branding is preserved.
alter table public.organizations alter column brand_color set default '#5369e8';
