import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { deployBendCompetition } from '../../helpers/contracts-deployments';

import { eNetwork } from '../../helpers/types';

task(`deploy-bend-competition`, `Deploys the BendCompetition contract`)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
    await DRE.run('set-DRE');
    const network = <eNetwork>DRE.network.name;

    const bendCompetition = await deployBendCompetition(network, verify);
    console.log(`Deployed BendCompetition at ${bendCompetition.address}`);
  });
