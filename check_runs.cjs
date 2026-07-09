const https = require('https');

https.get('https://api.github.com/repos/xdgtweb/cristalliquido/actions/runs', {
  headers: { 'User-Agent': 'Node.js' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.workflow_runs) {
        json.workflow_runs.slice(0, 5).forEach(run => {
          console.log(`- ${run.name} | Status: ${run.status} | Conclusion: ${run.conclusion} | Commit: ${run.head_commit?.message} | Created: ${run.created_at}`);
        });
      } else {
        console.log(data);
      }
    } catch (e) {
      console.log('Parse error', e.message);
    }
  });
}).on('error', (e) => {
  console.error(e);
});
