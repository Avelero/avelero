#!/usr/bin/env node
/**
 * Test script to trigger validate-and-stage task with a real CSV file
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
config({ path: resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BRAND_ID = '2251e120-c782-4d01-b4f4-0d1f964c90bc';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function uploadAndTrigger() {
  try {
    // Read test CSV file
    const csvPath = resolve(__dirname, '../../csv/4_unmapped_values.csv');
    console.log('Reading CSV file:', csvPath);
    const fileBuffer = readFileSync(csvPath);

    // Generate job ID and file path
    const jobId = randomUUID();
    const filename = '4_unmapped_values.csv';
    const storagePath = `${BRAND_ID}/${jobId}/${filename}`;

    console.log('Uploading to storage:', storagePath);

    // Upload file to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product-imports')
      .upload(storagePath, fileBuffer, {
        contentType: 'text/csv',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload failed:', uploadError);
      process.exit(1);
    }

    console.log('File uploaded successfully:', uploadData.path);

    // Create import job in database
    console.log('Creating import job...');
    const { data: jobData, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        id: jobId,
        brand_id: BRAND_ID,
        filename: filename,
        status: 'PENDING',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      console.error('Failed to create import job:', jobError);
      process.exit(1);
    }

    console.log('Import job created:', jobData);

    // Trigger the validate-and-stage task using Trigger.dev SDK
    console.log('\nTriggering validate-and-stage task...');
    const { tasks } = await import('@trigger.dev/sdk/v3');

    const runHandle = await tasks.trigger('validate-and-stage', {
      jobId: jobId,
      brandId: BRAND_ID,
      filePath: storagePath,
    });

    console.log('\n✅ Task triggered successfully!');
    console.log('Run ID:', runHandle.id);
    console.log('Job ID:', jobId);
    console.log('Dashboard:', `https://cloud.trigger.dev/projects/v3/proj_mqxiyipljbptdmfeivig/runs/${runHandle.id}`);
    console.log('\nMonitor the dev server logs to see the task execution...');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

uploadAndTrigger();
