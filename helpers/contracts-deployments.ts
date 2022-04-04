import {
  BendCompetitionMainnet__factory,
  BendCompetitionRinkeby__factory,
  BendCompetitionTest__factory,
  CryptoPunksMarket__factory,
  MintableERC20__factory,
  MintableERC721__factory,
  Treasury__factory,
  VeBend__factory,
  WETHGateway__factory,
} from '../types';
import { getFirstSigner } from './contracts-getters';
import { withSaveAndVerify } from './contracts-helpers';
import { eContractid, eEthereumNetwork, eNetwork } from './types';
export const deployMintableERC20 = async (
  args: [string, string, string],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new MintableERC20__factory(await getFirstSigner()).deploy(...args),
    eContractid.MintableERC20,
    args,
    verify
  );

export const deployMintableERC721 = async (
  args: [string, string],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new MintableERC721__factory(await getFirstSigner()).deploy(...args),
    eContractid.MintableERC721,
    args,
    verify
  );

export const deployCryptoPunksMarket = async (args: [], verify?: boolean) =>
  withSaveAndVerify(
    await new CryptoPunksMarket__factory(await getFirstSigner()).deploy(
      ...args
    ),
    eContractid.CryptoPunksMarket,
    args,
    verify
  );

export const deployBendCompetitionTest = async (
  args: Array<any>,
  verify?: boolean
) => {
  let hre = await import('hardhat');
  const upgradeable = await hre.ethers.getContractFactory(
    'BendCompetitionTest'
  );
  let contract = await hre.upgrades.deployProxy(upgradeable, args);
  return withSaveAndVerify(
    contract,
    eContractid.BendCompetition,
    args,
    verify
  );
};

export const deployBendCompetition = async (
  network: eNetwork,
  verify?: boolean
) => {
  const factory = {
    [eEthereumNetwork.coverage]: null,
    [eEthereumNetwork.hardhat]: BendCompetitionRinkeby__factory,
    [eEthereumNetwork.main]: BendCompetitionMainnet__factory,
    [eEthereumNetwork.rinkeby]: BendCompetitionRinkeby__factory,
    [eEthereumNetwork.localhost]: null,
  }[network];

  if (!factory) {
    throw new Error(`Unsupported network: ${network}`);
  }

  return withSaveAndVerify(
    await new factory(await getFirstSigner()).deploy(),
    eContractid.BendCompetition,
    [],
    verify
  );
};

export const deployBendCompetitionProxy = async (
  network: eNetwork,
  verify?: boolean
) => {
  const factory = {
    [eEthereumNetwork.coverage]: null,
    [eEthereumNetwork.hardhat]: null,
    [eEthereumNetwork.main]: 'BendCompetitionMainnet',
    [eEthereumNetwork.rinkeby]: 'BendCompetitionRinkeby',
    [eEthereumNetwork.localhost]: null,
  }[network];

  if (!factory) {
    throw new Error(`Unsupported network: ${network}`);
  }

  let hre = await import('hardhat');
  const upgradeable = await hre.ethers.getContractFactory(factory);
  let contract = await hre.upgrades.deployProxy(upgradeable, []);
  return withSaveAndVerify(contract, eContractid.BendCompetition, [], verify);
};

export const deployWETHGateway = async (args: [], verify?: boolean) =>
  withSaveAndVerify(
    await new WETHGateway__factory(await getFirstSigner()).deploy(...args),
    eContractid.WETHGateway,
    [],
    verify
  );

export const deployTreasury = async (args: [], verify?: boolean) =>
  withSaveAndVerify(
    await new Treasury__factory(await getFirstSigner()).deploy(...args),
    eContractid.Treasury,
    [],
    verify
  );

export const deployVeBend = async (args: [string], verify?: boolean) =>
  withSaveAndVerify(
    await new VeBend__factory(await getFirstSigner()).deploy(...args),
    eContractid.VeBend,
    args,
    verify
  );
