import { BigNumberish } from '@ethersproject/bignumber';
import {
  CryptoPunksMarket__factory,
  MintableERC20__factory,
  MintableERC721__factory,
  BendCompetitionTest__factory,
  WETHGateway__factory,
  Treasury__factory,
} from '../types';
import { getFirstSigner } from './contracts-getters';
import { withSaveAndVerify } from './contracts-helpers';
import { eContractid } from './types';

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
  args: Parameters<typeof BendCompetitionTest__factory['prototype']['deploy']>,
  verify?: boolean
) =>
  withSaveAndVerify(
    await new BendCompetitionTest__factory(await getFirstSigner()).deploy(
      ...args
    ),
    eContractid.BendCompetition,
    [...args],
    verify
  );

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
