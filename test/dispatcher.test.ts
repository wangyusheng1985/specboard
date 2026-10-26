import {test} from 'node:test';
import assert from 'node:assert/strict';
import {agentContainerConfig} from '../src/dispatcher.ts';
test('Agent container has fixed image, mounts, resource limits and no Docker socket',()=>{
 const config=agentContainerConfig({id:'11111111-1111-1111-1111-111111111111',generation:1,projectId:'p',token:'runtime-token'},{image:'agent:fixed',apiUrl:'http://api:3000',network:'internal',workspaceVolume:'work',sessionVolume:'sessions',gatewayToken:'gateway'});
 assert.equal(config.Image,'agent:fixed');assert.equal(config.HostConfig.ReadonlyRootfs,true);assert.equal(config.HostConfig.PidsLimit,256);assert.deepEqual(config.HostConfig.CapDrop,['ALL']);assert.ok(!JSON.stringify(config.HostConfig.Mounts).includes('docker.sock'));assert.equal(config.HostConfig.Mounts.length,2);
 assert.throws(()=>agentContainerConfig({id:'--privileged',generation:1,projectId:'p',token:''},{image:'a',apiUrl:'a',network:'a',workspaceVolume:'a',sessionVolume:'a',gatewayToken:''}),/identity/);
});
