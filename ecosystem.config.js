module.exports = {
    apps: [
        {
            name: 'api-server',
            script: 'npx',
            args: 'tsx watch lib/api/server.ts',
            cwd: '/Users/georgeershov/Desktop/ai-assis/qa-sentinel',
            env_file: '.env.local'
        },
        {
            name: 'worker',
            script: 'npx',
            args: 'tsx watch lib/api/worker.ts',
            cwd: '/Users/georgeershov/Desktop/ai-assis/qa-sentinel',
            env_file: '.env.local'
        }
    ]
};