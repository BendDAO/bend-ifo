import { Contract, Signer, utils } from 'ethers';

import { MintableERC20 } from '../types/MintableERC20';
import { MintableERC721 } from '../types/MintableERC721';
import { getFirstSigner } from './contracts-getters';
import { verifyEtherscanContract } from './etherscan-verification';
import { DRE, getDb, waitForTx } from './misc-utils';
import { eContractid, tEthereumAddress } from './types';

export type MockTokenMap = { [symbol: string]: MintableERC20 };
export type MockNftMap = { [symbol: string]: MintableERC721 };

export const registerContractInJsonDb = async (
  contractId: string,
  contractInstance: Contract
) => {
  const currentNetwork = DRE.network.name;
  const FORK = process.env.FORK;
  if (
    FORK ||
    (currentNetwork !== 'hardhat' && !currentNetwork.includes('coverage'))
  ) {
    console.log(`*** ${contractId} ***\n`);
    console.log(`Network: ${currentNetwork}`);
    console.log(`tx: ${contractInstance.deployTransaction.hash}`);
    console.log(`contract address: ${contractInstance.address}`);
    console.log(`deployer address: ${contractInstance.deployTransaction.from}`);
    console.log(`gas price: ${contractInstance.deployTransaction.gasPrice}`);
    console.log(`gas used: ${contractInstance.deployTransaction.gasLimit}`);
    console.log(`\n******`);
    console.log();
  }

  await getDb(currentNetwork)
    .set(`${contractId}`, {
      address: contractInstance.address,
      deployer: contractInstance.deployTransaction.from,
    })
    .write();

  console.log(
    'contracts-helpers:registerContractInJsonDb,',
    'contractId:',
    contractId,
    'address:',
    contractInstance.address,
    'deployer',
    contractInstance.deployTransaction.from
  );
};

export const insertContractAddressInDb = async (
  id: eContractid,
  address: tEthereumAddress
) => {
  console.log(
    'contracts-helpers:insertContractAddressInDb,',
    'id:',
    id,
    'address',
    address
  );
  await getDb(DRE.network.name)
    .set(`${id}`, {
      address,
    })
    .write();
};

export const rawInsertContractAddressInDb = async (
  id: string,
  address: tEthereumAddress
) => {
  console.log(
    'contracts-helpers:rawInsertContractAddressInDb,',
    'id:',
    id,
    'address',
    address
  );
  await getDb(DRE.network.name)
    .set(`${id}`, {
      address,
    })
    .write();
};

export const getContractAddressInDb = async (
  id: string
): Promise<tEthereumAddress> => {
  const contractAtDb = await getDb(DRE.network.name).get(`${id}`).value();
  if (contractAtDb?.address) {
    return contractAtDb.address as tEthereumAddress;
  }
  throw Error(
    `Missing contract address ${id} at Market config and JSON local db`
  );
};

export const getEthersSigners = async (): Promise<Signer[]> => {
  const ethersSigners = await Promise.all(await DRE.ethers.getSigners());
  return ethersSigners;
};

export const getEthersSignerByAddress = async (
  address: string
): Promise<Signer> => {
  const ethersSigner = await DRE.ethers.getSigner(address);
  return ethersSigner;
};

export const getEthersSignersAddresses = async (): Promise<
  tEthereumAddress[]
> =>
  await Promise.all(
    (await getEthersSigners()).map((signer) => signer.getAddress())
  );

export const getCurrentBlock = async () => {
  return DRE.ethers.provider.getBlockNumber();
};

export const decodeAbiNumber = (data: string): number =>
  parseInt(utils.defaultAbiCoder.decode(['uint256'], data).toString());

export const deployContract = async <ContractType extends Contract>(
  contractName: string,
  args: any[]
): Promise<ContractType> => {
  console.log(
    'contracts-helpers:deployContract,',
    'contractName',
    contractName
  );
  const contract = (await (await DRE.ethers.getContractFactory(contractName))
    .connect(await getFirstSigner())
    .deploy(...args)) as ContractType;
  await waitForTx(contract.deployTransaction);
  await registerContractInJsonDb(<eContractid>contractName, contract);
  return contract;
};

export const withSaveAndVerify = async <ContractType extends Contract>(
  instance: ContractType,
  id: string,
  args: (string | string[])[],
  verify?: boolean
): Promise<ContractType> => {
  //console.log('contracts-helpers:withSaveAndVerify,','id',id)
  await waitForTx(instance.deployTransaction);
  await registerContractInJsonDb(id, instance);
  if (verify) {
    await verifyContract(id, instance, args);
  }
  return instance;
};

export const getContract = async <ContractType extends Contract>(
  contractName: string,
  address: string
): Promise<ContractType> =>
  (await DRE.ethers.getContractAt(contractName, address)) as ContractType;

export const verifyContract = async (
  id: string,
  instance: Contract,
  args: (string | string[])[]
) => {
  await verifyEtherscanContract(instance.address, args);
  return instance;
};
