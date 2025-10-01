/**
* Fastify routes for test scenarios (presets)
*/

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { RealisticDataGenerator } from '../../modules/form-testing/RealisticDataGenerator';
import { createLogger } from '../../shared/logger';
import type { TestDataPreset } from '../../modules/form-testing/types';

const logger = createLogger('test-scenarios-routes');

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface GetScenariosParams {
  userId: string;
}

interface CreateScenarioBody {
  userId: string;
  preset: Omit<TestDataPreset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
}

interface GenerateDefaultsBody {
  userId: string;
}

export async function testScenariosRoutes(server: FastifyInstance) {
  /**
   * GET /api/test-scenarios/:userId
   * Get all test scenarios for a user
   */
  server.get<{ Params: GetScenariosParams }>(
    '/api/test-scenarios/:userId',
    async (request: FastifyRequest<{ Params: GetScenariosParams }>, reply: FastifyReply) => {
      try {
        const { userId } = request.params;

        const { data, error } = await supabase
          .from('form_test_scenarios')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        return reply.send({
          success: true,
          scenarios: data || [],
        });
      } catch (error) {
        logger.error('Error fetching test scenarios:', error as Error);

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch scenarios',
        });
      }
    }
  );

  /**
   * POST /api/test-scenarios
   * Create or update a test scenario
   */
  server.post<{ Body: CreateScenarioBody }>(
    '/api/test-scenarios',
    async (request: FastifyRequest<{ Body: CreateScenarioBody }>, reply: FastifyReply) => {
      try {
        const { userId, preset } = request.body;

        // Check if preset with same name exists
        const { data: existing } = await supabase
          .from('form_test_scenarios')
          .select('id')
          .eq('user_id', userId)
          .eq('preset_name', preset.presetName)
          .single();

        let result;

        if (existing) {
          // Update existing
          result = await supabase
            .from('form_test_scenarios')
            .update({
              preset_type: preset.presetType,
              preset_data: preset.presetData,
              is_active: preset.isActive ?? true,
            })
            .eq('id', existing.id)
            .select()
            .single();
        } else {
          // Insert new
          result = await supabase
            .from('form_test_scenarios')
            .insert({
              user_id: userId,
              preset_type: preset.presetType,
              preset_name: preset.presetName,
              preset_data: preset.presetData,
              is_active: preset.isActive ?? true,
            })
            .select()
            .single();
        }

        if (result.error) {
          throw result.error;
        }

        return reply.send({
          success: true,
          scenario: result.data,
        });
      } catch (error) {
        logger.error('Error creating/updating scenario:', error as Error);

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save scenario',
        });
      }
    }
  );

  /**
   * POST /api/test-scenarios/generate-defaults
   * Generate default presets for a user
   */
  server.post<{ Body: GenerateDefaultsBody }>(
    '/api/test-scenarios/generate-defaults',
    async (request: FastifyRequest<{ Body: GenerateDefaultsBody }>, reply: FastifyReply) => {
      try {
        const { userId } = request.body;

        // Check if user already has presets
        const { data: existing } = await supabase
          .from('form_test_scenarios')
          .select('id')
          .eq('user_id', userId)
          .limit(1);

        if (existing && existing.length > 0) {
          return reply.send({
            success: true,
            message: 'User already has presets',
            generated: false,
          });
        }

        // Generate default presets
        const defaultPresets = RealisticDataGenerator.generateDefaultPresets(userId);

        // Insert all presets
        const { data, error } = await supabase
          .from('form_test_scenarios')
          .insert(
            defaultPresets.map((p) => ({
              user_id: p.userId!,
              preset_type: p.presetType,
              preset_name: p.presetName,
              preset_data: p.presetData,
              is_active: p.isActive ?? true,
            }))
          )
          .select();

        if (error) {
          throw error;
        }

        return reply.send({
          success: true,
          message: 'Default presets generated',
          generated: true,
          scenarios: data,
        });
      } catch (error) {
        logger.error('Error generating default presets:', error as Error);

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate presets',
        });
      }
    }
  );
}
