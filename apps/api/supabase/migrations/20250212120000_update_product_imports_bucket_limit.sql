-- Update product-imports bucket size limit to 5GB for existing environments
update storage.buckets
set file_size_limit = 5368709120
where id = 'product-imports';
